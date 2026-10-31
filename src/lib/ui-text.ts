// Textes de l'interface pour la gestion des comptes (ticket #4), regroupés ici pour être
// déplacés tels quels dans les catalogues de traduction (next-intl, ticket #5).

export const adminText = {
  usersTitle: "Utilisateurs",
  noUsers: "Aucun utilisateur.",
  columns: { email: "Email", name: "Nom", status: "Statut", createdAt: "Créé le", actions: "Actions" },
  status: { active: "Actif", disabled: "Désactivé" },
  disable: "Désactiver",
  enable: "Réactiver",
  revokeSessions: "Révoquer les sessions",
  resetPassword: "Réinitialiser le mot de passe",
  delete: "Supprimer",
  temporaryPasswordPrompt: (email: string) =>
    `Mot de passe temporaire pour ${email} (10 caractères minimum) :`,
  confirmDelete: (email: string) =>
    `Supprimer ${email} et toutes ses données (mesures, campagnes, réglages) ? Cette action est définitive.`,
  confirmDisable: (email: string) => `Désactiver ${email} ? Ses sessions seront révoquées.`,
  done: {
    disable: "Utilisateur désactivé.",
    enable: "Utilisateur réactivé.",
    revokeSessions: "Sessions révoquées.",
    resetPassword: "Mot de passe réinitialisé. Communiquez-le à l’utilisateur.",
    delete: "Utilisateur supprimé.",
  },
  failed: "L’action a échoué.",
  settingsTitle: "Inscription libre",
  signUpOpenLabel: "Autoriser l’inscription libre",
  signUpHelp: "Fermée, seul l’admin crée les comptes.",
};

export const passwordText = {
  bannerMessage: "Votre mot de passe a été réinitialisé. Nous vous conseillons de le changer.",
  bannerAction: "Changer mon mot de passe",
  bannerDismiss: "Fermer",
  changeTitle: "Changer mon mot de passe",
  currentPassword: "Mot de passe actuel",
  newPassword: "Nouveau mot de passe",
  submit: "Enregistrer",
  changed: "Mot de passe changé.",
  failed: "Le changement de mot de passe a échoué.",
  back: "Retour à l’accueil",
};

export const signUpText = {
  title: "Créer un compte",
  closed: "L’inscription est fermée. Demandez un compte à l’administrateur.",
  name: "Nom",
  email: "Email",
  password: "Mot de passe",
  submit: "Créer mon compte",
  failed: "La création du compte a échoué.",
  link: "Créer un compte",
  toLogin: "J’ai déjà un compte",
};

export const loginText = {
  disabled: "Ce compte est désactivé. Contactez l’administrateur.",
};
