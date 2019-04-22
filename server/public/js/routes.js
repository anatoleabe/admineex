angular.module('routes', []).config(['$stateProvider', '$urlRouterProvider', '$httpProvider', '$locationProvider', function ($stateProvider, $urlRouterProvider, $httpProvider, $locationProvider) {

        $urlRouterProvider.otherwise('/error/404');

        $stateProvider.state('installation', {
            abstract: true,
            url: '/installation',
            views: {
                'content': {
                    templateUrl: 'templates/installation/installation.html',
                }
            },
            access: {requiredAuthentication: false}
        }).state('installation.first', {
            url: '',
            templateUrl: 'templates/installation/first.html',
            controller: 'InstallationController',
            access: {requiredAuthentication: false},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/InstallationCtrl.js');
                    }]
            }
        }).state('installation.second', {
            url: '/second',
            templateUrl: 'templates/installation/second.html',
            controller: 'InstallationController',
            access: {requiredAuthentication: false},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/InstallationCtrl.js');
                    }]
            }
        }).state('sign', {
            url: '/sign',
            views: {
                'content': {
                    templateUrl: 'templates/sign/sign.html'
                }
            },
            access: {requiredAuthentication: false}
        }).state('signin', {
            url: '/signin',
            params: {isNew: null, isResetted: null, isLost: null, email: null},
            views: {
                'content': {
                    templateUrl: 'templates/sign/signin.html',
                    controller: 'SigninController'
                }
            },
            access: {requiredAuthentication: false},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/sign/SigninCtrl.js');
                    }]
            }
        }).state('recovery', {
            abstract: true,
            url: '/recovery',
            views: {
                'content': {
                    templateUrl: 'templates/recovery/recovery.html'
                }
            },
            access: {requiredAuthentication: false}
        }).state('recovery.lost', {
            url: '/lost',
            templateUrl: 'templates/recovery/lost.html',
            controller: 'LostController',
            access: {requiredAuthentication: false},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/recovery/LostCtrl.js');
                    }]
            }
        }).state('recovery.reset', {
            url: '/reset/:token',
            templateUrl: 'templates/recovery/reset.html',
            controller: 'ResetController',
            access: {requiredAuthentication: false},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/recovery/ResetCtrl.js');
                    }]
            }
        }).state('home', {
            abstract: true,
            url: '/',
            views: {
                'header': {
                    templateUrl: 'templates/menu/menu.html',
                    controller: 'MenuController'
                },
                'content': {
                    templateUrl: 'templates/home.html'
                }
            },
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/MenuCtrl.js');
                    }]
            }
        }).state('home.dashboard', {// Define dashboard page (ABSTRACT)
            abstract: true,
            url: '',
            templateUrl: 'templates/dashboard/dashboard.html',
            access: {requiredAuthentication: true}
        }).state('home.dashboard.main', {// Define dashboard page
            url: '',
            templateUrl: 'templates/dashboard/main.html',
            controller: 'DashboardController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/DashboardCtrl.js');
                    }]
            }
        }).state('home.users', {
            abstract: true,
            url: 'users',
            templateUrl: 'templates/users/users.html',
            access: {requiredAuthentication: true},
        }).state('home.users.main', {
            url: '',
            templateUrl: 'templates/users/main.html',
            controller: 'UsersController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/users/UsersCtrl.js');
                    }]
            },
            breadcrumbs: ["Users"]
        }).state('home.users.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/users/edit.html',
            controller: 'UserController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/users/UserCtrl.js');
                    }]
            },
            breadcrumbs: ["Users", "Edit"]
        }).state('home.users.profile', {
            url: '/preview/:id',
            templateUrl: 'templates/users/profile.html',
            controller: 'UserController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/users/UserCtrl.js');
                    }]
            },
            breadcrumbs: ["Users", "Preview"]
        }).state('home.users.new', {
            url: '/new',
            templateUrl: 'templates/users/edit.html',
            controller: 'UserController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/users/UserCtrl.js');
                    }]
            },
            breadcrumbs: ["Users", "New"]
        }).state('home.staffs', {
            abstract: true,
            url: 'staffs',
            access: {requiredAuthentication: true},
            templateUrl: 'templates/staffManagement/staffManagement.html',
            controller: 'StaffManagementController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/StaffManagementCtrl.js');
                    }]
            },
        }).state('home.staffs.staffmanagement', {
            url: '/staffmanagement',
            templateUrl: 'templates/staffManagement/staff/main.html',
            controller: 'StaffsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/staff/StaffsCtrl.js');
                    }]
            },
            breadcrumbs: ["Staffs management"]
        }).state('home.staffs.staffmanagement.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/staffManagement/staff/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/staff/StaffCtrl.js');
                    }]
            },
            breadcrumbs: ["Staffs management", "Edit"]
        }).state('home.staffs.staffmanagement.new', {
            url: '/new',
            templateUrl: 'templates/staffManagement/staff/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/staff/StaffCtrl.js');
                    }]
            },
            breadcrumbs: ["Staffs management", "New"]
        }).state('home.staffs.personnalrecords', {
            url: '/personnalrecords',
            params: {id: undefined, personnelID: undefined},
            templateUrl: 'templates/staffManagement/personnal_records.html',
            controller: 'PersonnalRecordsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/PersonnalRecordsCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Personnal records"]
        }).state('home.staffs.movement', {
            abstract: true,
            url: '/movement',
            access: {requiredAuthentication: true}
        }).state('home.staffs.movement.main', {
            url: '',
            templateUrl: 'templates/staffManagement/movement/main.html',
            controller: 'MovementsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/movement/MovementsCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Movement"]
        }).state('home.staffs.movement.new', {
            url: '/new',
            templateUrl: 'templates/staffManagement/movement/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/movement/MovementCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Movement", "New"]
        }).state('home.staffs.movement.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/staffManagement/movement/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/movement/MovementCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Movement", "Edit"]
        }).state('home.staffs.status', {
            abstract: true,
            url: '/status',
            access: {requiredAuthentication: true}
        }).state('home.staffs.status.main', {
            url: '',
            templateUrl: 'templates/staffManagement/status/main.html',
            controller: 'StatussController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/status/StatussCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Status"]
        }).state('home.staffs.status.new', {
            url: '/new',
            templateUrl: 'templates/staffManagement/status/edit.html',
            controller: 'StatusController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/movement/StatusCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Status", "New"]
        }).state('home.staffs.status.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/staffManagement/status/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/status/StatusCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Status", "Edit"]
        }).state('home.staffs.discipline', {
            abstract: true,
            url: '/discipline',
            access: {requiredAuthentication: true}
        }).state('home.staffs.discipline.main', {
            url: '',
            templateUrl: 'templates/staffManagement/discipline/main.html',
            controller: 'DisciplinesController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/discipline/DisciplinesCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Discipline"]
        }).state('home.staffs.discipline.new', {
            url: '/new',
            templateUrl: 'templates/staffManagement/discipline/edit.html',
            controller: 'DisciplineController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/movement/DisciplineCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Discipline", "New"]
        }).state('home.staffs.discipline.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/staffManagement/discipline/edit.html',
            controller: 'DisciplineController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staff_management/discipline/DisciplineCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Discipline", "Edit"]
        }).state('home.projects.profile', {
            url: '/preview/:id',
            templateUrl: 'templates/projects/profile.html',
            controller: 'ProjectController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/projects/ProjectCtrl.js');
                    }]
            },
            breadcrumbs: ["Projects", "Preview"]
        }).state('home.projects.new', {
            url: '/new',
            params: {duplicateID: null},
            templateUrl: 'templates/projects/edit.html',
            controller: 'ProjectController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/projects/ProjectCtrl.js');
                    }]
            },
            breadcrumbs: ["Projects", "New"]
        }).state('home.administration', {
            abstract: true,
            url: 'administration',
            controller: 'AdministrationController',
            templateUrl: 'templates/administration/administration.html',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/AdministrationCtrl.js');
                    }]
            }
        }).state('home.administration.positions', {
            url: '/contacts',
            templateUrl: 'templates/administration/positions/main.html',
            controller: 'PositionsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/administration/positions/PositionsCtrl.js');
                    }]
            },
            breadcrumbs: ["Administration", "Positions"]
        }).state('home.administration.structures', {
            url: '/structures',
            templateUrl: 'templates/administration/structures/main.html',
            controller: 'StructuresController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/administration/structures/StructuresCtrl.js');
                    }]
            },
            breadcrumbs: ["Administration", "Structures"]
        }).state('home.organizations.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/organizations/edit.html',
            controller: 'OrganizationController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/organizations/OrganizationCtrl.js');
                    }]
            },
            breadcrumbs: ["Organizations", "Edit"]
        }).state('home.organizations.profile', {
            url: '/preview/:id',
            templateUrl: 'templates/organizations/profile.html',
            controller: 'OrganizationController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/organizations/OrganizationCtrl.js');
                    }]
            },
            breadcrumbs: ["Organizations", "Preview"]
        }).state('home.organizations.new', {
            url: '/new',
            params: {duplicateID: null},
            templateUrl: 'templates/organizations/edit.html',
            controller: 'OrganizationController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/organizations/OrganizationCtrl.js');
                    }]
            },
            breadcrumbs: ["Organizations", "New"]
        }).state('home.audit', {
            url: 'audit',
            templateUrl: 'templates/audit.html',
            controller: 'AuditController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/AuditCtrl.js');
                    }]
            },
            breadcrumbs: ["Audit"]
        }).state('home.configuration', {
            url: 'configuration',
            templateUrl: 'templates/configuration.html',
            controller: 'ConfigurationController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/ConfigurationCtrl.js');
                    }]
            },
            breadcrumbs: ["Configuration"]
        }).state('home.profile', {
            abstract: true,
            url: 'profile',
            templateUrl: 'templates/profile/profile.html',
            controller: 'ProfileController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/ProfileCtrl.js');
                    }]
            }
        }).state('home.profile.main', {
            url: '',
            templateUrl: 'templates/profile/main.html',
            controller: 'ProfileController',
            access: {requiredAuthentication: true},
            breadcrumbs: ["Profile"]
        }).state('home.profile.name', {
            url: '/name',
            templateUrl: 'templates/profile/name.html',
            controller: 'ProfileController',
            access: {requiredAuthentication: true},
            breadcrumbs: ["Profile", "Name"]
        }).state('home.profile.email', {
            url: '/email',
            templateUrl: 'templates/profile/email.html',
            controller: 'ProfileController',
            access: {requiredAuthentication: true},
            breadcrumbs: ["Profile", "Email"]
        }).state('home.profile.phone', {
            url: '/phone',
            templateUrl: 'templates/profile/phone.html',
            controller: 'ProfileController',
            access: {requiredAuthentication: true},
            breadcrumbs: ["Profile", "Phone"]
        }).state('home.settings', {
            abstract: true,
            url: 'settings',
            templateUrl: 'templates/settings/settings.html',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/SettingsCtrl.js');
                    }]
            }
        }).state('home.settings.main', {
            url: '',
            templateUrl: 'templates/settings/main.html',
            controller: 'SettingsController',
            access: {requiredAuthentication: true},
            breadcrumbs: ["Settings", "Edit"]
        }).state('home.settings.avatar', {
            url: '/avatar',
            templateUrl: 'templates/settings/avatar.html',
            controller: 'SettingsController',
            access: {requiredAuthentication: true},
            breadcrumbs: ["Settings", "Avatar"]
        }).state('home.settings.password', {
            url: '/password',
            templateUrl: 'templates/settings/password.html',
            controller: 'SettingsController',
            access: {requiredAuthentication: true},
            breadcrumbs: ["Settings", "Password"]
        }).state('home.settings.language', {
            url: '/language',
            templateUrl: 'templates/settings/language.html',
            controller: 'SettingsController',
            access: {requiredAuthentication: true},
            breadcrumbs: ["Settings", "Language"]
        }).state('home.settings.notifications', {
            url: '/notifications',
            templateUrl: 'templates/settings/notifications.html',
            controller: 'SettingsController',
            access: {requiredAuthentication: true},
            breadcrumbs: ["Settings", "Notifications"]
        }).state('home.import_export', {
            url: 'import_export',
            templateUrl: 'templates/import_export.html',
            controller: 'Import_ExportController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/Import_ExportCtrl.js');
                    }]
            },
            breadcrumbs: ["Import-Export"]
        }).state('home.error', {
            url: 'error/:status',
            templateUrl: 'templates/error.html',
            controller: 'ErrorController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/ErrorCtrl.js');
                    }]
            }
        }).state('home.about', {
            url: 'about',
            templateUrl: 'templates/about.html',
            access: {requiredAuthentication: true},
            noLoading: true
        });

        $locationProvider.html5Mode(true);
        $httpProvider.interceptors.push('TokenInterceptor');
    }]).run(function ($rootScope, $location, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $timeout, $transitions, $filter) {
    $rootScope.kernel = {
    };

    $transitions.onStart({}, function (trans) {
        var nextState = trans.to();
        if (!nextState.noLoading) {
            $rootScope.kernel.loading = 0;
        }
        $rootScope.account = {};

        $rootScope.kernel.isMain = true;
        $rootScope.kernel.version = "Version 1.1";
        $rootScope.kernel.released = "19/11/2018";

        $rootScope.kernel.background = 'world';
        $rootScope.kernel.title = 'Persabe - DGTCFM';
        $rootScope.kernel.logo = {
            large: '../img/logos/logo-full.png',
            small: '../img/logos/logo.png'
        };

        // Personalize index.html
        $window.document.title = $rootScope.kernel.title;
        (function () {
            var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = '../img/logos/favicon.ico';
            document.getElementsByTagName('head')[0].appendChild(link);
        })();


        if (!$rootScope.kernel.alerts || $rootScope.kernel.alerts.length == 0) {
            $rootScope.kernel.alerts = [];
        }

        $rootScope.href = function (state) {
            $state.go(state);
        }

        // Build date range
        $rootScope.range = {
            min: new Date(1970, 0, 1),
            max: new Date(2100, 0, 1),
            from: {
                isOpen: false,
                isDisabled: true,
                value: new Date(2016, 3, 1)
            },
            to: {
                isOpen: false,
                isDisabled: true,
                value: new Date(2020, 11, 31)
            }
        };

        // Export a PNG version of the chart/map
        $rootScope.exportPNG = function (content, title) {
            $rootScope.kernel.loading = 0;
            var filename = 'Persabe-DGTCFM_' + title.replace(/ /g, '-');
            if (typeof content === 'string') {
                filename += '_';
                $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                    var url_base64 = document.getElementById(content).toDataURL('image/png').replace("data:image/png;base64,", "");
                    var data = atob(url_base64);
                    var asArray = new Uint8Array(data.length);
                    for (var i = 0, len = data.length; i < len; ++i) {
                        asArray[i] = data.charCodeAt(i);
                    }
                    var FileSaver = $injector.get('FileSaver');
                    var d = new Blob([asArray.buffer], {type: "data:image/png;base64"});
                    FileSaver.saveAs(d, filename + '.png');
                    $rootScope.kernel.loading = 100;
                });
            } else {
                content.getHighcharts().exportChartLocal({type: 'image/png', filename: filename}, {title: {text: title}});
                $rootScope.kernel.loading = 100;
            }
        }

        // Set a focus on the specified input
        $rootScope.setFocus = function (name) {
            $timeout(function () {
                angular.element("input[name=" + name + "]").focus();
            }, 0);
        }

        // Build account profile
        if ($window.localStorage.token && !$rootScope.account.email) {
            $ocLazyLoad.load('js/services/AccountService.js').then(function () {
                var Account = $injector.get('Account');
                Account.read().then(function (response) {
                    var profile = response.data;
                    $window.localStorage.language = profile.language;
                    $rootScope.account.firstname = profile.firstname;
                    $rootScope.account.lastname = profile.lastname;
                    $rootScope.account.email = profile.email;
                    $rootScope.account.role = profile.role;
                    if (profile.preferences !== undefined && profile.preferences.avatar !== undefined) {
                        $rootScope.account.avatar = profile.preferences.avatar;
                    }
                }).catch(function (response) {
                    console.log(response);
                });
            });
        }

        // Build language
        gettextCatalog.currentLanguage = ($window.localStorage.language !== undefined) ? $window.localStorage.language.toLowerCase() : (navigator.language.substr(0, 2) || navigator.userLanguage.substr(0, 2));

        if (nextState.breadcrumbs) {
            $rootScope.kernel.isMain = false;
            $rootScope.kernel.breadcrumbs = [];
            for (i = 0; i < nextState.breadcrumbs.length; i++) {
                $rootScope.kernel.breadcrumbs.push(gettextCatalog.getString(nextState.breadcrumbs[i]));
            }
        }

        if (nextState !== null && nextState.access !== null && nextState.access.requiredAuthentication && !$window.localStorage.token) {
            $location.path("/signin");
        }

        if ($location.path().indexOf('installation') == -1) {
            $ocLazyLoad.load('js/services/InstallationService.js').then(function () {
                var Installation = $injector.get('Installation');
                Installation.status().then(function (response) {
                    if (response.data) {
                    } else {
                        $location.path("/installation");
                    }
                }).catch(function (response) {
                    console.log(response);
                    $location.path("/signin");
                });
            });
        }
    });
});
