window.NIHONGO_CONFIG = {
  // Leave empty for local development. Set this to the public backend URL when deployed.
  apiBaseUrl: '',

  // Free mode keeps all core learning features in the browser.
  // Set plan to 'paid' after a real payment/login system is connected.
  premiumFeaturesEnabled: true,
  plan: 'free',
  premiumUnlocked: false,
  quotas: {
    paidDaily: {
      urlExtract: 60,
      serverFileExtract: 20,
      onlineDictionary: 120
    }
  }
};
