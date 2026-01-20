import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { Database } from "bun:sqlite";
import { Moyennes, Notes, scrape } from "./util";
import { CronJob } from "cron";
import config from "./config";

export type RealNotes = {
  [trimestre: string]: Notes;
};
export type RealMoyennes = {
  [trimestre: string]: Moyennes;
};

class User {
  id!: string;
  notify!: boolean;
  username!: string;
  password!: string;
  notes!: RealNotes;
  moyennes!: RealMoyennes;

  constructor(
    id: string,
    notify: boolean,
    username: string,
    password: string,
    notes: string,
    moyennes: string,
  ) {
    this.id = id;
    this.notify = notify;
    this.username = username;
    this.password = password;
    this.notes = JSON.parse(notes);
    this.moyennes = JSON.parse(moyennes);
  }
}

const db = new Database(
  `db${process.argv.includes("--dev") ? "-dev" : ""}.sqlite`,
  { create: true, readwrite: true },
);
db.query(
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, notify BOOL, username TEXT, password TEXT, notes TEXT, moyennes TEXT)",
).run();

const USERS: { [id: string]: User } = {};

const client = new Client({ intents: [GatewayIntentBits.DirectMessages] });

client.on(Events.MessageCreate, async (message) => {
  if (
    message.author.id == config.owner &&
    message.content.startsWith("!send ")
  ) {
    const content = message.content.slice("!send ".length);

    for (const u of Object.keys(USERS)) {
      await client.users.cache.get(u)?.send({
        content,
      });
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName == "whatif") {
      const u = USERS[interaction.user.id];

      if (!u)
        return await interaction.respond([
          {
            name: config.translation.not_logged_in,
            value: config.translation.not_logged_in,
          },
        ]);

      const typ = interaction.options.getFocused().toLowerCase();
      const filtered = Object.keys(u.notes).filter((c) =>
        c.toLowerCase().includes(typ),
      );

      await interaction.respond(
        filtered.map((choice) => ({ name: choice, value: choice })),
      );
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId == "notif-off") {
      if (USERS[interaction.user.id]) USERS[interaction.user.id].notify = false;
      db.query("UPDATE users SET notify = ?1 WHERE id = ?2").run(
        false,
        interaction.user.id,
      );

      await interaction.reply({
        content:
          config.translation.notification.disabled[
            Math.floor(
              Math.random() * config.translation.notification.disabled.length,
            )
          ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("notif-on")
              .setEmoji(config.translation.notification.disabled_button.emoji)
              .setLabel(config.translation.notification.disabled_button.label)
              .setStyle(ButtonStyle.Primary),
          ),
        ],
      });
    }

    if (interaction.customId == "notif-on") {
      if (USERS[interaction.user.id]) USERS[interaction.user.id].notify = false;
      db.query("UPDATE users SET notify = ?1 WHERE id = ?2").run(
        true,
        interaction.user.id,
      );

      await interaction.reply({
        content:
          config.translation.notification.enabled[
            Math.floor(
              Math.random() * config.translation.notification.enabled.length,
            )
          ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("notif-off")
              .setEmoji(config.translation.notification.enabled_button.emoji)
              .setLabel(config.translation.notification.enabled_button.label)
              .setStyle(ButtonStyle.Primary),
          ),
        ],
      });
    }
  }

  if (interaction.isChatInputCommand()) {
    if (!config.whitelist.includes(interaction.user.id))
      return await interaction.reply({
        content: config.translation.not_whitelisted,
        flags: [MessageFlags.Ephemeral],
      });

    if (interaction.commandName == "login") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const username = interaction.options.getString("username", true);
      const password = interaction.options.getString("password", true);

      if (USERS[interaction.user.id]) {
        USERS[interaction.user.id].username = username;
        USERS[interaction.user.id].password = password;

        db.query(
          "UPDATE users SET username = ?1, password = ?2 WHERE id = ?3",
        ).run(username, password, interaction.user.id);
      } else {
        USERS[interaction.user.id] = new User(
          interaction.user.id,
          true,
          username,
          password,
          "{}",
          "{}",
        );

        db.query(
          "INSERT INTO users (id, notify, username, password, notes, moyennes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        ).run(interaction.user.id, true, username, password, "{}", "{}");
      }
      return await interaction.editReply({
        content: config.translation.logged_in,
      });
    }

    if (interaction.commandName == "pronote") {
      const u = USERS[interaction.user.id];

      if (!u)
        return await interaction.reply({
          content: config.translation.not_logged_in,
          flags: [MessageFlags.Ephemeral],
        });
      await interaction.deferReply();

      try {
        if (!u.moyennes[config.TRIMESTRE] || !u.notes[config.TRIMESTRE]) {
          const result = (
            await scrape([{ username: u.username, password: u.password }])
          )[0];

          u.moyennes[config.TRIMESTRE] = result.moyennes;
          u.notes[config.TRIMESTRE] = result.notes;
        }

        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                `${config.translation.grades} ${u.username
                  .slice(0, 3)
                  .toUpperCase()}...`,
              )
              .setColor("#393A41")
              .setDescription(
                `${config.translation.grades.average} **${(
                  Object.values(u.moyennes[config.TRIMESTRE]!).reduce(
                    (a, b) => a + b,
                    0,
                  ) / Object.keys(u.moyennes[config.TRIMESTRE]!).length
                ).toFixed(2)}**\n——————————\n${
                  config.translation.grades.per_subject
                }\n${Object.keys(u.moyennes!)
                  .sort(
                    (a, b) =>
                      u.moyennes[config.TRIMESTRE]![b] -
                      u.moyennes[config.TRIMESTRE]![a],
                  )
                  .map(
                    (m) =>
                      `**${u.moyennes[config.TRIMESTRE]![m].toFixed(
                        2,
                      )}** : ${m}`,
                  )
                  .join("\n")}`,
              )
              .setFooter({ text: `${config.TRIMESTRE}` }),
          ],
        });
      } catch (err) {
        await interaction.editReply({
          content: config.translation.error_occured + "\n" + err,
        });
      }
    }

    if (interaction.commandName == "whatif") {
      const u = USERS[interaction.user.id];
      const i_got = interaction.options.getString("i_got", true);
      const matiere = interaction.options.getString("in", true);

      if (!u)
        return await interaction.reply({
          content: config.translation.not_logged_in,
          flags: [MessageFlags.Ephemeral],
        });

      let [note, sur] = i_got
        .replaceAll(",", ".")
        .split("/")
        .map((v) => +v);
      if (!sur || sur == 0) sur = 20;
      if (isNaN(note) || isNaN(sur) || note > sur || note < 0 || sur < 0)
        return await interaction.reply({
          content: config.translation.whatif.invalid_input,
          flags: [MessageFlags.Ephemeral],
        });

      const found = u.notes[config.TRIMESTRE][matiere]?.map((v) => v.note);
      if (!found)
        return await interaction.reply({
          content: config.translation.whatif.no_grades,
          flags: [MessageFlags.Ephemeral],
        });

      await interaction.deferReply();

      const oldM = makeMoyenne(found).toFixed(2);
      const newM = makeMoyenne(found.concat(`${note}/${sur}`));
      const moyennes = Object.keys(u.moyennes[config.TRIMESTRE]).map((k) =>
        k == matiere ? newM : u.moyennes[config.TRIMESTRE][k]!,
      );

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `**${u.username.slice(0, 3).toUpperCase()}...**: ${
                config.translation.whatif.what_if
              }`,
            )
            .setColor("#393A41")
            .setDescription(
              `${
                config.translation.whatif.current_average_in
              } **${matiere}**: ${u.moyennes[config.TRIMESTRE][matiere]}${
                u.moyennes[config.TRIMESTRE][matiere].toFixed(2) != oldM
                  ? config.translation.whatif.calculation_error(oldM)
                  : ""
              }\n> ${config.translation.whatif.add_of(
                note,
                sur,
              )} [${oldM}] -> **[${newM.toFixed(2)}]** !\n${
                config.translation.whatif.new_average
              } [${
                (
                  Object.values(u.moyennes[config.TRIMESTRE]).reduce(
                    (a, b) => a + b,
                    0,
                  ) / Object.keys(u.moyennes[config.TRIMESTRE]).length
                )?.toFixed(2) || "/"
              }] -> **[${(
                Object.values(moyennes).reduce((a, b) => a + b, 0) /
                Object.keys(moyennes).length
              ).toFixed(2)}]**`,
            )
            .setFooter({ text: `${config.TRIMESTRE}` }),
        ],
      });
    }
  }
});

client.on(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}!`);

  await client.application?.commands.set([
    new SlashCommandBuilder()
      .setName("login")
      .setDescription(config.translation.commands.login.description)
      .setIntegrationTypes(1)
      .setContexts(0, 1, 2)
      .addStringOption((opt) =>
        opt
          .setName("username")
          .setDescription(config.translation.commands.login.username)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(20),
      )
      .addStringOption((opt) =>
        opt
          .setName("password")
          .setDescription(config.translation.commands.login.password)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(20),
      ),
    new SlashCommandBuilder()
      .setName("pronote")
      .setDescription(config.translation.commands.pronote.description)
      .setIntegrationTypes(1)
      .setContexts(0, 1, 2),
    new SlashCommandBuilder()
      .setName("whatif")
      .setDescription(config.translation.commands.whatif.description)
      .setIntegrationTypes(1)
      .setContexts(0, 1, 2)
      .addStringOption((opt) =>
        opt
          .setName("i_got")
          .setDescription(config.translation.commands.whatif.i_got)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(8),
      )
      .addStringOption((opt) =>
        opt
          .setName("in")
          .setDescription(config.translation.commands.whatif.in)
          .setRequired(true)
          .setAutocomplete(true),
      ),
  ]);

  const query = db.query("SELECT * FROM users").as(User).all();
  query.forEach(async (u) => {
    if (typeof u.notes == "string") u.notes = JSON.parse(u.notes);
    if (typeof u.moyennes == "string") u.moyennes = JSON.parse(u.moyennes);

    USERS[u.id] = u;
    const user = await client.users.fetch(u.id);
    await user.createDM();
  });

  CronJob.from({
    cronTime: "1,31 7-22 * * *",
    onTick: update,
    start: true,
    runOnInit: true,
  });
});

async function update() {
  try {
    const result = await scrape([
      ...new Set(
        Object.values(USERS).map((u) => ({
          username: u.username,
          password: u.password,
        })),
      ),
    ]);

    console.log(`Updated for ${result.length} users`);

    result.forEach((r) => {
      Object.keys(USERS)
        .filter(
          (u) =>
            USERS[u].username == r.username && USERS[u].password == r.password,
        )
        .forEach(async (u) => {
          if (!USERS[u].notes) USERS[u].notes = {};
          if (!USERS[u].moyennes) USERS[u].moyennes = {};

          if (
            USERS[u] &&
            USERS[u].notify &&
            USERS[u].notes &&
            USERS[u].moyennes &&
            USERS[u].notes[config.TRIMESTRE] &&
            USERS[u].moyennes[config.TRIMESTRE] &&
            Object.keys(USERS[u].notes).length != 0 &&
            Object.keys(USERS[u].moyennes).length != 0
          ) {
            let before = USERS[u].notes;

            let changes: {
              matiere: string;
              date: string;
              note: string;
            }[] = Object.keys(r.notes)
              .map((n) => {
                const normalized = r.notes[n].map((note) => ({
                  matiere: n,
                  date: note.date,
                  note: note.note,
                }));

                if (
                  !before ||
                  !before[config.TRIMESTRE] ||
                  !before[config.TRIMESTRE][n]
                )
                  return [];

                return normalized.filter(
                  (nn) =>
                    !before[config.TRIMESTRE][n].some(
                      (oldNote) =>
                        oldNote.date === nn.date && oldNote.note === nn.note,
                    ),
                );
              })
              .filter((l) => l.length > 0)
              .flat();

            if (changes.length > 0) {
              (
                await client.users.fetch(u, { cache: true, force: false })
              )?.send({
                embeds: [
                  new EmbedBuilder()
                    .setTitle(
                      `**${USERS[u].username.slice(0, 3).toUpperCase()}...**: ${
                        config.translation.new_grades.new_grades
                      }`,
                    )
                    .setColor("#393A41")
                    .setDescription(
                      config.translation.new_grades.changes +
                        "\n" +
                        changes
                          .map(
                            (c) =>
                              `${config.translation.new_grades.you_got(
                                c.matiere,
                                c.date,
                                c.note,
                              )}\n> ${
                                config.translation.new_grades.new_average
                              } [${
                                USERS[u].moyennes[config.TRIMESTRE]![
                                  c.matiere
                                ]?.toFixed(2) || "/"
                              }] -> **[${r.moyennes[c.matiere].toFixed(2)}]**`,
                          )
                          .join("\n\n") +
                        "\n\n" +
                        `${config.translation.new_grades.new_global_average} [${
                          (
                            Object.values(
                              USERS[u].moyennes[config.TRIMESTRE]!,
                            ).reduce((a, b) => a + b, 0) /
                            Object.keys(USERS[u].moyennes[config.TRIMESTRE]!)
                              .length
                          )?.toFixed(2) || "/"
                        }] -> **[${(
                          Object.values(r.moyennes!).reduce(
                            (a, b) => a + b,
                            0,
                          ) / Object.keys(r.moyennes!).length
                        ).toFixed(2)}]**`,
                    )
                    .setFooter({ text: `${config.TRIMESTRE}` }),
                ],
                components: [
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setCustomId("notif-off")
                      .setEmoji(
                        config.translation.notification.enabled_button.emoji,
                      )
                      .setLabel(
                        config.translation.notification.enabled_button.label,
                      )
                      .setStyle(ButtonStyle.Primary),
                  ),
                ],
              });
            }
          }

          USERS[u].notes[config.TRIMESTRE] = r.notes;
          USERS[u].moyennes[config.TRIMESTRE] = r.moyennes;
          db.query(
            "UPDATE users SET notes = ?1, moyennes = ?2 WHERE id = ?3",
          ).run(
            JSON.stringify(USERS[u].notes),
            JSON.stringify(USERS[u].moyennes),
            u,
          );
        });
    });
  } catch (err) {
    console.error("Could not update", err);
  }
}

function makeMoyenne(notes: string[]): number {
  let parsed = notes.map((n) => {
    let [note, sur] = n
      .replaceAll(",", ".")
      .split("/")
      .map((v) => +v);
    if (!sur || sur == 0) sur = 20;

    return [note, sur];
  });

  const total = parsed.reduce((p, c) => p + c[0], 0);
  const out_of = parsed.reduce((p, c) => p + c[1], 0) || 1;

  return (total / out_of) * 20;
}

client.login(process.env.DISCORD_TOKEN);
client.on("error", (err) => console.error(err));
process.on("uncaughtException", (err) => console.error(err));
process.on("unhandledRejection", (err) => console.error(err));
