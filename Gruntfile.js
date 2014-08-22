module.exports = function(grunt) {

  grunt.initConfig({

    pkg: grunt.file.readJSON('./package.json'),

    jshint: {
      options: grunt.file.readJSON('lint-options.json'), // see http://www.jshint.com/docs/options/
      all: {
        src: ['package.json', 'lint-options.json', 'Gruntfile.js',
              'src/**/*.js', 'test/**/*.js']
      }
    },

    mochaTest: {
      options: { colors: true, reporter: 'spec' },
      files: ['test/*.spec.js']
    },

    browserify: {
      build: {
        files: { 'lib/<%= pkg.name %>-<%= pkg.version %>.js': 'src/<%= pkg.name %>.js' },
        options: { bundleOptions: {
          debug: true,  // for source maps
          standalone: '<%= pkg["export-symbol"]%>'
        } }
      }
    },

    uglify: {
      min: { files: { 'lib/<%= pkg.name %>-<%= pkg.version %>.min.js': 'lib/<%= pkg.name %>-<%= pkg.version %>.js' } }
    },

    symlink: {
      options: { overwrite: true },
      develop: {
        src: 'lib/<%= pkg.name %>-<%= pkg.version %>.js',
        dest: 'lib/<%= pkg.name %>.js'
      },
      min: {
        src: 'lib/<%= pkg.name %>-<%= pkg.version %>.min.js',
        dest: 'lib/<%= pkg.name %>.min.js'
      }
    }

  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-symlink');

  grunt.registerTask('default', ['jshint', 'mochaTest', 'browserify', 'uglify', 'symlink']);

};
