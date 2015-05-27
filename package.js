Package.describe({
  name: 'kepler:autoform-wizard',
  summary: 'A multi step form component for AutoForm.',
  version: '0.0.2_1',
  git: 'https://github.com/kepler/meteor-autoform-wizard.git'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');

  api.use([
    'underscore',
    'tracker',
    'reactive-var',
    'templating',
    'blaze',
    'session',
    'ejson',
    'localstorage'
  ], 'client');

  api.use('aldeed:autoform@5.0.0', 'client');
  api.use('underscorestring:underscore.string@3.0.3', ['client', 'server']);

  api.addFiles([
    'wizard.html',
    'wizard.js',
    'router.js',
    'cache.js'
  ], 'client');

  if (api.export)
    api.export('Wizard', 'client');
});