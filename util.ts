import { chromium } from "playwright";
import config from "./config";

export type Moyennes = { [matiere: string]: number };
export type Notes = {
  [matiere: string]: { date: string; nom: string; note: string }[];
};

export async function scrape(
  accounts: { username: string; password: string }[],
): Promise<
  { username: string; password: string; moyennes: Moyennes; notes: Notes }[]
> {
  const browser = await chromium.launch({ headless: true });

  const result = [];

  for (const { username, password } of accounts) {
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(config.PRONOTE_URL, {
        waitUntil: "domcontentloaded",
      });

      await page
        .getByLabel("Saisissez votre identifiant")
        .fill(username, { timeout: 10000 });
      await page
        .getByLabel("Saisissez votre mot de passe")
        .fill(password, { timeout: 1000 });
      await page.getByText("Se Connecter").click({ timeout: 1000 });

      await page.waitForLoadState("domcontentloaded");

      await page.getByText("Notes", { exact: true }).hover({ timeout: 10000 });
      await page.waitForTimeout(1000);
      await page
        .getByText("Mes notes", { exact: true })
        .click({ timeout: 2000 });

      // select trimestre
      /*await page
        .getByLabel("Sélectionnez une période")
        .click({ timeout: 10000 });

      await page
        .locator(
          '[id="GInterface.Instances[2].Instances[0]_ContenuScroll"] > *'
        )
        .getByText(config.TRIMESTRE, { exact: true })
        .click({ timeout: 10000 });*/

      // then
      await page.waitForTimeout(1000);
      await page
        .getByText("Par matière", { exact: true })
        .click({ timeout: 10000 });

      await page.waitForTimeout(500);
      await page.waitForSelector(
        '[id="GInterface.Instances[2].Instances[1]_grid_0"] > *',
        { timeout: 10000 },
      );
      const matieres = page.locator(
        '[id="GInterface.Instances[2].Instances[1]_grid_0"] > *',
      );

      const MOYENNES: Moyennes = {};
      const NOTES: Notes = {};

      const count = await matieres.count();
      let current = "";
      for (let i = 0; i < count; i++) {
        const mat = matieres.nth(i);

        const text = (await mat.innerText()).trim();
        if (text) {
          if ((await mat.getByLabel("Moyenne élève").count()) == 0) {
            const split = text.split("\n").filter((a) => a);
            if (split.includes("Abs")) continue;

            const noName = !Number.isNaN(+split[1][0]);

            console.log(noName, split);
            const noteValue = noName ? split[1] : split[2];
            if (!noteValue) continue;

            NOTES[current].push({
              date: split[0], // always
              nom: noName ? "" : split[1],
              note: noteValue.replaceAll(",", "."),
            });
          } else {
            const [matiere, moyenne] = text.split("\n");

            current = matiere;
            if (!NOTES[current]) NOTES[current] = [];
            MOYENNES[matiere] = parseFloat(moyenne.replace(",", "."));
          }
        }
      }

      await page.close();
      result.push({ username, password, moyennes: MOYENNES, notes: NOTES });
    } catch (err) {
      console.error(err);
    }
  }

  await browser.close();
  return result;
}
