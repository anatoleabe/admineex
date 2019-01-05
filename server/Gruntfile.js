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
                        'public/js/controllers/organizations/*.js',
                        'public/js/controllers/projects/*.js',
                        'public/js/controllers/recovery/*.js',
                        'public/js/controllers/sign/*.js',
                        'public/js/controllers/users/*.js',
                        'public/templates/*.html',
                        'public/templates/dashboard/*.html',
                        'public/templates/dashboard/cards/*.html',
                        'public/templates/installation/*.html',
                        'public/templates/menu/*.html',
                        'public/templates/profile/*.html',
                        'public/templates/organizations/*.html',
                        'public/templates/projects/*.html',
                        'public/templates/recovery/*.html',
                        'public/templates/settings/*.html',
                        'public/templates/sign/*.html',
                        'public/templates/users/*.html'
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
