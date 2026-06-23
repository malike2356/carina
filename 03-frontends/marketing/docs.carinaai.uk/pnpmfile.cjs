module.exports = {
  hooks: {
    readPackage(pkg) {
      if (
        pkg.name === 'copy-webpack-plugin' &&
        pkg.dependencies &&
        pkg.dependencies['serialize-javascript']
      ) {
        pkg.dependencies['serialize-javascript'] = '7.0.5';
      }

      if (
        pkg.name === 'css-minimizer-webpack-plugin' &&
        pkg.dependencies &&
        pkg.dependencies['serialize-javascript']
      ) {
        pkg.dependencies['serialize-javascript'] = '7.0.5';
      }

      if (pkg.name === 'sockjs' && pkg.dependencies && pkg.dependencies.uuid) {
        pkg.dependencies.uuid = '11.1.1';
      }

      return pkg;
    },
  },
};
