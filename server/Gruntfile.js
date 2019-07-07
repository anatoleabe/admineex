module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        nggettext_extract: {
            pot: {
                files: {
                    'resources/languages/template.pot': [
                        'resources/languages/extraDictionary.html',
                        'app/controllers/*.js',
                        'public/js/*.js',
                        'public/js/controllers/*.js',
                        'public/js/controllers/**/*.js',
                        'public/js/controllers/sign/*.js',
                        'public/js/controllers/users/*.js',
                        'public/templates/*.html',
                        'public/templates/**/*.html',
                        'public/templates/**/**/*.html',
                        'resources/pdf/*.html'
                    ]
                }
            }
        },
        nggettext_compile: {
            all: {
                files: {
                    'public/js/appTranslations.js': ['resources/languages/*.po']
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-angular-gettext');

    // Default task(s).
    grunt.registerTask('default', ['nggettext_extract', 'nggettext_compile']);
};
