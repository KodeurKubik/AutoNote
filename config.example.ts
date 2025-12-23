export default {
  owner: "your discord id",
  whitelist: [
    "your discord id",
    "a friend discord id",
    "etc...",
    "one more maybe?",
  ],
  TRIMESTRE: "Trimestre 2",
  // replace --something_here-- with the actual subdomain
  PRONOTE_URL:
    "https://--something_here--.index-education.net/pronote/eleve.html",

  // ---- TRANSLATION ----
  // only change if needed!
  translation: {
    not_logged_in: "utilise /login avant",
    logged_in: "tu es connecté !",
    not_whitelisted: "Pas dans la whiteliste :(",
    notification: {
      disabled: ["ok je me tait", "ok."],
      disabled_button: {
        emoji: "🗣️",
        label: "nn en fait désactive",
      },
      enabled: [
        "https://tenor.com/view/horse-ok-gif-2466171479878054943",
        "ok je vais te notifier.",
      ],
      enabled_button: {
        emoji: "🤫",
        label: "nan chut en fait",
      },
    },
    grades: {
      from: "Notes de",
      average: "Moyenne générale :",
      per_subject: "Moyenne par matière :",
    },
    error_occured: "jcrois ya une erreur",
    whatif: {
      invalid_input: "ton entrée est invalide",
      no_grades: "ya pas de notes dans cette matiere (utilise l'autocomplete)",
      what_if: "What If",
      current_average_in: "Moyenne actuelle en",
      calculation_error: (oldM: string) =>
        `(calculé ${oldM} c la faute a pronote si c different)`,
      add_of: (note: number, sur: number) =>
        `Avec l'ajout d'un ${note}/${sur}... 🥁\n\nÇa changera ta moyenne de`,
      new_average: "Et la moyenne générale passera de",
    },
    new_grades: {
      new_grades: "Nouvelles Notes !",
      changes: "Changements :",
      you_got: (subject: string, date: string, grade: string) =>
        `[En **${subject}**, le ${date}] : t'as eu \`${grade}\``,
      new_average: "Nouvelle Moyenne :",
      new_global_average: "Nouvelle Moyenne Générale :",
    },
    commands: {
      login: {
        description: "Entre tes identifiants pronote :)",
        username: "ton nom d'utilisateur",
        password: "ton mot de passe",
      },
      pronote: {
        description: "Choppe tes notes et ta moyenne pronote",
      },
      whatif: {
        description:
          "Calcule une moyenne a partir d'une note en plus dans une matière",
        i_got: "la note (ex 8/10) et c sur 20 sinon",
        in: "la matière (utilise l'autocomplete stp)",
      },
    },
  },
};
