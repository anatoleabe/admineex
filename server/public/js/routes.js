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
                'topnavbar': {
                    templateUrl: 'templates/menu/topnavbar.html',
                    controller: 'MenuController'
                },
                'leftsidebar': {
                    templateUrl: 'templates/menu/leftsidebar.html',
                    controller: 'MenuController'
                },
                'header': {
                    templateUrl: 'templates/menu/menu.html',
                    controller: 'MenuController'
                },
                'contentheader': {
                    templateUrl: 'templates/menu/contentheader.html',
                    controller: 'MenuController'
                },
                'content': {
                    templateUrl: 'templates/home.html'
                },
                'footer': {
                    templateUrl: 'templates/menu/footer.html'
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
            templateUrl: 'templates/staffs/staffManagement.html',
            controller: 'StaffManagementController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/StaffManagementCtrl.js');
                    }]
            },
        }).state('home.staffs.main', {
            url: '/management',
            templateUrl: 'templates/staffs/staff/main.html',
            controller: 'StaffsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/staff/StaffsCtrl.js');
                    }]
            },
            breadcrumbs: ["Staffs management"]
        }).state('home.staffs.edit', {
            url: '/management/edit/:id',
            templateUrl: 'templates/staffs/staff/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/staff/StaffCtrl.js');
                    }]
            },
            breadcrumbs: ["Staffs", "Staffs management", "Edit"]
        }).state('home.staffs.new', {
            url: '/management/new',
            templateUrl: 'templates/staffs/staff/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/staff/StaffCtrl.js');
                    }]
            },
            breadcrumbs: ["Staffs", "Staffs management", "New"]
        }).state('home.staffs.personnalrecords', {
            url: '/personnalrecords',
            params: {id: undefined, opath: undefined},
            templateUrl: 'templates/staffs/personnal_records.html',
            controller: 'PersonnalRecordsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/PersonnalRecordsCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Personnal records"]
        }).state('home.staffs.retired', {
            url: '/retired',
            params: {id: undefined, opath: undefined},
            templateUrl: 'templates/staffs/staff/retireds.html',
            controller: 'RetiredController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/staff/RetiredCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Retirement"]
        }).state('home.staffs.assignments', {
            url: '/assignments',
            params: {id: undefined, opath: undefined},
            templateUrl: 'templates/staffs/staff/assignmenthistory.html',
            controller: 'AssignmentHistoryController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/staff/AssignmentHistoryCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Assignment management"]
        }).state('home.staffs.sanctions', {
            url: '/sanctions',
            params: {id: undefined, opath: undefined},
            templateUrl: 'templates/staffs/staff/sanctionsmanagement.html',
            controller: 'SanctionsManagementController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/staff/SanctionsManagementCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Sanctions management"]
        }).state('home.staffs.statofsanctions', {
            url: '/statofsanctions',
            params: {id: undefined, opath: undefined},
            templateUrl: 'templates/staffs/staff/statisticOfSanctions.html',
            controller: 'SanctionsStatisticsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/staff/SanctionsStatisticsCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Sanctions management", "Statistics of sanctions"]
        }).state('home.staffs.movement', {
            abstract: true,
            url: '/movement',
            access: {requiredAuthentication: true}
        }).state('home.staffs.movement.main', {
            url: '',
            templateUrl: 'templates/staffs/movement/main.html',
            controller: 'MovementsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/movement/MovementsCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Movement"]
        }).state('home.staffs.movement.new', {
            url: '/new',
            templateUrl: 'templates/staffs/movement/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/movement/MovementCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Movement", "New"]
        }).state('home.staffs.movement.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/staffs/movement/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/movement/MovementCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Movement", "Edit"]
        }).state('home.staffs.status', {
            abstract: true,
            url: '/status',
            access: {requiredAuthentication: true}
        }).state('home.staffs.status.main', {
            url: '',
            templateUrl: 'templates/staffs/status/main.html',
            controller: 'StatussController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/status/StatussCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Status"]
        }).state('home.staffs.status.new', {
            url: '/new',
            templateUrl: 'templates/staffs/status/edit.html',
            controller: 'StatusController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/movement/StatusCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Status", "New"]
        }).state('home.staffs.status.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/staffs/status/edit.html',
            controller: 'StaffController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/status/StatusCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Status", "Edit"]
        }).state('home.staffs.discipline', {
            abstract: true,
            url: '/discipline',
            access: {requiredAuthentication: true}
        }).state('home.staffs.discipline.main', {
            url: '',
            templateUrl: 'templates/staffs/discipline/main.html',
            controller: 'DisciplinesController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/discipline/DisciplinesCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Discipline"]
        }).state('home.staffs.discipline.new', {
            url: '/new',
            templateUrl: 'templates/staffs/discipline/edit.html',
            controller: 'DisciplineController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/movement/DisciplineCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Discipline", "New"]
        }).state('home.staffs.discipline.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/staffs/discipline/edit.html',
            controller: 'DisciplineController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/staffs/discipline/DisciplineCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff management", "Discipline", "Edit"]
        }).state('home.monitor', {// Define monitor page (ABSTRACT)
            abstract: true,
            url: 'monitor',
            templateUrl: 'templates/monitor/monitor.html',
            access: {requiredAuthentication: true}
        }).state('home.monitor.main', {
            url: '',
            templateUrl: 'templates/monitor/main.html',
            controller: 'MonitorController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/MonitorCtrl.js');
                    }]
            },
            breadcrumbs: ["Staff monitoring and evaluation"]
        }).state('home.tasks', {
            abstract: true,
            url: 'tasks',
            controller: 'ProcrastinateController',
            templateUrl: 'templates/procrastinate/procrastinate.html',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/procrastinate/ProcrastinateCtrl.js');
                    }]
            }
        }).state('home.tasks.main', {
            url: '',
            templateUrl: 'templates/procrastinate/tasks/main.html',
            controller: 'TasksController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/procrastinate/tasks/TasksCtrl.js');
                    }]
            },
            breadcrumbs: ["Tasks Management"]
        }).state('home.tasks.edit', {
            url: '/tasks/edit/:id',
            templateUrl: 'templates/procrastinate/tasks/edit.html',
            controller: 'TaskController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/procrastinate/tasks/TaskCtrl.js');
                    }]
            },
            breadcrumbs: ["Task Management", "Edit"]
        }).state('home.tasks.new', {
            url: '/tasks/new',
            templateUrl: 'templates/procrastinate/tasks/edit.html',
            controller: 'TaskController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/procrastinate/tasks/TaskCtrl.js');
                    }]
            },
            breadcrumbs: ["Task Management", "New"]
        }).state('home.tasks.synthesis', {
            url: '/synthesis',
            templateUrl: 'templates/procrastinate/synthesis/main.html',
            controller: 'DashboardController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/procrastinate/DashboardCtrl.js');
                    }]
            },
            breadcrumbs: ["Tasks dashboard"]
        }).state('home.tasks.categories', {
            url: '/categories',
            templateUrl: 'templates/procrastinate/categories/main.html',
            controller: 'CategoriesController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/procrastinate/categories/CategoriesCtrl.js');
                    }]
            },
            breadcrumbs: ["Tasks categories"]
        }).state('home.tasks.category', {
            url: '/category/new',
            templateUrl: 'templates/procrastinate/categories/edit.html',
            controller: 'CategoryController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/procrastinate/categories/CategoryCtrl.js');
                    }]
            },
            breadcrumbs: ["Task category", "New"]
        }).state('home.tasks.category.edit', {
            url: '/category/edit/:id',
            templateUrl: 'templates/procrastinate/categories/edit.html',
            controller: 'CategoryController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/procrastinate/categories/CategoryCtrl.js');
                    }]
            },
            breadcrumbs: ["Task category", "Edit"]
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
            url: '/positions',
            templateUrl: 'templates/administration/positions/main.html',
            controller: 'PositionsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/administration/positions/PositionsCtrl.js');
                    }]
            },
            breadcrumbs: ["Administration", "Positions"]
        }).state('home.administration.details', {
            url: '/positions/details/:id',
            templateUrl: 'templates/administration/positions/details.html',
            controller: 'PositionDetailsController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/administration/positions/PositionDetailsCtrl.js');
                    }]
            },
            breadcrumbs: ["Administration", "Positions", "Details"]
        }).state('home.administration.new', {
            url: '/new',
            templateUrl: 'templates/administration/positions/edit.html',
            controller: 'PositionController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/administration/positions/PositionCtrl.js');
                    }]
            },
            breadcrumbs: ["Administration", "Positions", "New"]
        }).state('home.administration.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/administration/positions/edit.html',
            controller: 'PositionController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/administration/positions/PositionCtrl.js');
                    }]
            },
            breadcrumbs: ["Administration", "Positions", "Edit"]
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
        }).state('home.administration.structures.new', {
            url: '/new',
            templateUrl: 'templates/administration/structures/edit.html',
            controller: 'StructureController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/administration/structures/StructureCtrl.js');
                    }]
            },
            breadcrumbs: ["Administration", "Structures", "New"]
        }).state('home.administration.structures.edit', {
            url: '/edit/:id',
            templateUrl: 'templates/administration/structures/edit.html',
            controller: 'StructureController',
            access: {requiredAuthentication: true},
            resolve: {
                loadMyCtrl: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load('js/controllers/administration/structures/StructureCtrl.js');
                    }]
            },
            breadcrumbs: ["Administration", "Structures", "Edit"]
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
        }).state("home.thresholds", {
          url: "thresholds",
          templateUrl: "templates/thresholds.html",
          controller: "ThresholdsController",
          access: { requiredAuthentication: true },
          resolve: {
            loadMyCtrl: [
              "$ocLazyLoad",
              function ($ocLazyLoad) {
                return $ocLazyLoad.load("js/controllers/ThresholdsCtrl.js");
              },
            ],
          },
          breadcrumbs: ["Thresholds"],
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
    }]).run(function ($rootScope, $location, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $timeout, $transitions, $filter, $q) {
    $rootScope.kernel = {
    };

    $rootScope.globalView = {
        activated: false,
        selectedUser: undefined
    };

    $transitions.onStart({}, function (trans) {
        var nextState = trans.to();
        if (!nextState.noLoading) {
            $rootScope.kernel.loading = 0;
        }
        $rootScope.account = {};

        $rootScope.kernel.isMain = true;
        $rootScope.kernel.version = "Version 2.2.4";
        $rootScope.kernel.released = "26/04/2022";

        $rootScope.kernel.background = 'world';
        $rootScope.kernel.title = 'Admineex - DGTCFM';
        $rootScope.kernel.logo = {
            large: '../img/logos/logo-full.png',
            small: '../img/logos/logo-small.png',
            apps: '../img/logos/logo.png',
            dark: '../img/logos/logo-dark.png'
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
        if (!$rootScope.range) {
            var max = new Date();
            max.setDate(max.getDate() + 1);
            $rootScope.range = {
                min: new Date(1970, 0, 1),
                max: max,
                from: {
                    isOpen: false,
                    isDisabled: true,
                    value: new Date(new Date(new Date(new Date().setFullYear(new Date().getFullYear() - 1))).setHours(0, 0, 0, 0)),
                    handleShowCalendar: function ($event) {
                        this.isOpen = true;
                        this.isDisabled = false;
                    },
                    handleBlur: function () {
                        this.isOpen = false;
                        this.isDisabled = true;
                    }
                },
                to: {
                    isOpen: false,
                    isDisabled: true,
                    value: new Date(new Date(new Date(new Date().setDate(new Date().getDate()))).setHours(23, 59, 59, 999)),
                    handleShowCalendar: function ($event) {
                        this.isOpen = true;
                        this.isDisabled = false;
                    },
                    handleBlur: function () {
                        this.isOpen = false;
                        this.isDisabled = true;
                    }
                }
            };
        }

        // Export a PNG version of the chart/map
        $rootScope.exportPNG = function (content, title) {
            $rootScope.kernel.loading = 0;
            var filename = 'Admineex-server_' + title.replace(/ /g, '-');
            filename += '_' + $filter('ddMMyyyy')($rootScope.range.from.value) + '-' + $filter('ddMMyyyy')($rootScope.range.to.value);

            //Hidding unwanted items
            var toHide = document.getElementsByClassName("hide-before-export");
            for (var j = 0; j < toHide.length; j++) {
                toHide[j].style.display = 'none';
            }

            // converting HTML to canvas
            $ocLazyLoad.load('js/services/CanvasService.js').then(function () {
                var Canvas = $injector.get('Canvas');
                Canvas.getCanvas(content, function (canvas) {
                    //Canvas to png
                    var url_base64 = canvas.toDataURL('image/png').replace("data:image/png;base64,", "");

                    //dispaying back items that were hidden
                    for (var j = 0; j < toHide.length; j++) {
                        toHide[j].style.display = null;
                    }
                    //Saving the file
                    $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                        var data = atob(url_base64);
                        var asArray = new Uint8Array(data.length);
                        for (var i = 0, len = data.length; i < len; ++i) {
                            asArray[i] = data.charCodeAt(i);
                        }
                        var FileSaver = $injector.get('FileSaver');
                        var d = new Blob([asArray.buffer], { type: "data:image/png;base64" });
                        FileSaver.saveAs(d, filename + '.png');
                        $rootScope.kernel.loading = 100;
                    });
                });
            });
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
                    $rootScope.account.id = profile._id;
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

        $rootScope.select = function (type) {
            $rootScope.selectedLaboratoriesTmp = [];

            switch (type) {
                case 'user':
                    

                    break;
            }
        };

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
        
        // Export an Excel version of the table/chart
        $rootScope.exportXLSX = function (content){
            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function() {
                var FileSaver = $injector.get('FileSaver');
                $rootScope.kernel.loading = 0;
                var filename = 'Admineex-server_' + content.title.replace(/ /g, '-');
                filename += '_' + $filter('ddMMyyyy')($rootScope.range.from.value) + '-' + $filter('ddMMyyyy')($rootScope.range.to.value);
                var deferred = $q.defer();
                function jsonBufferToObject (data, headersGetter, status) {
                    var type = headersGetter("Content-Type");
                    if (!type.startsWith("application/json")) {
                        return data;
                    };
                    var decoder = new TextDecoder("utf-8");
                    var domString = decoder.decode(data);
                    var json = JSON.parse(domString);
                    return json;
                };

                $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                    var Download = $injector.get('Download');
                    Download.start({
                        method: 'POST',
                        url:'/api/excelExport/card/',
                        data: content,
                        transformResponse: jsonBufferToObject
                    }).then(function(response){
                        var d = new Blob([response.data], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
                        FileSaver.saveAs(d, filename + '.xlsx');
                        $rootScope.kernel.loading = 100;
                        deferred.resolve(response.data);
                    }).catch(function(response) {
                        console.error(response);
                        if(response.data.error === '9500'){
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                priority: 1
                            });
                            $rootScope.kernel.loading = 100;
                        }
                    });
                });
            });
        }
        
    });
});
