angular.module('UserCtrl', []).controller('UserController', function ($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.user = {
        password: "",
        passwordConfirmation: "",
    };

    $scope.languagesList = [
        {name: 'English', value: 'EN'},
        {name: 'Français', value: 'FR'}
    ];
    
    // Roles will be loaded from API based on current user's permissions
    $scope.rolesList = [];
    $scope.rolesLoaded = false;
    
    $scope.loading = false;
    $scope.sending = false;

    $scope.myFilter = function (item) {
        return item.selected;
    };

    $scope.onlyDirection = function (item) {
        return item.rank == "2";
    };
    
    // Helper to get role badge color
    $scope.getRoleBadgeClass = function(roleId) {
        var classes = {
            '1': 'role-admin',
            '2': 'role-manager', 
            '3': 'role-supervisor',
            '4': 'role-editor',
            '5': 'role-task',
            '6': 'role-bonus-manager',
            '7': 'role-bonus-operator'
        };
        return classes[roleId] || 'role-default';
    };
    
    // Helper to get role icon
    $scope.getRoleIcon = function(roleId) {
        var icons = {
            '1': 'admin_panel_settings',
            '2': 'business',
            '3': 'supervisor_account',
            '4': 'edit',
            '5': 'assignment',
            '6': 'payments',
            '7': 'account_balance_wallet'
        };
        return icons[roleId] || 'person';
    };

    $ocLazyLoad.load('js/services/UserService.js').then(function () {
        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            var Structure = $injector.get('Structure');
            var User = $injector.get('User');

            // Load assignable roles from API
            User.assignableRoles().then(function(rolesResponse) {
                $scope.rolesList = rolesResponse.data.map(function(role) {
                    return {
                        name: gettextCatalog.getString(role.title),
                        value: String(role.id),
                        description: role.description
                    };
                });
                $scope.rolesLoaded = true;
            }).catch(function(err) {
                console.error('Failed to load assignable roles:', err);
                // Fallback to empty list - user won't be able to create users
                $scope.rolesList = [];
                $scope.rolesLoaded = true;
            });

            $rootScope.kernel.loading = 100;

            //Load structure list
            Structure.minimalList().then(function (response) {
                var dataStruc = response.data;
                $scope.structures = dataStruc;


                // Modify or Add ?
                if ($stateParams.id !== undefined) {
                    $scope.new = false;
                    $scope.passwordTitle = gettextCatalog.getString('New Password');
                    User.read({
                        id: $stateParams.id
                    }).then(function (response3) {
                        var data3 = response3.data;

                        if (data3.structures) {
                            for (i = 0; i < data3.structures.length; i++) {
                                for (j = 0; j < $scope.structures.length; j++) {
                                    if (data3.structures[i] == $scope.structures[j]._id) {
                                        $scope.structures[j].selected = true;
                                    }
                                }
                            }
                        }

                        $scope.user = data3;
                        $scope.user.password = "";
                        $scope.user.passwordConfirmation = "";
                        $scope.title = $scope.user.firstname + ' ' + $scope.user.lastname;
                    }).catch(function (response) {
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                    });

                    // Modify a user
                    $scope.submit = function () {
                        if ($scope.user.password != $scope.user.passwordConfirmation) {
                            $rootScope.kernel.alerts.push({
                                type: 2,
                                msg: gettextCatalog.getString("These passwords don't match"),
                                priority: 3
                            });
                        } else {
                            $rootScope.kernel.loading = 0;
                            User.update(
                                    $scope.user
                                    ).then(function (response) {
                                $state.transitionTo('home.users.main');
                                $rootScope.kernel.alerts.push({
                                    type: 3,
                                    msg: gettextCatalog.getString('The user has been updated'),
                                    priority: 4
                                });
                                $rootScope.kernel.loading = 100;
                            }).catch(function (response) {
                                $rootScope.kernel.loading = 100;
                                $rootScope.kernel.alerts.push({
                                    type: 1,
                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                    priority: 2
                                });
                            });
                        }
                    }
                } else {
                    $scope.new = true;
                    $scope.title = gettextCatalog.getString('New');
                    $scope.passwordTitle = gettextCatalog.getString('Password');

                    // Add a new user
                    $scope.submit = function () {

                        if ($scope.user.language != undefined && $scope.user.role != undefined) {


                            if ($scope.user.password === $scope.user.passwordConfirmation) {
                                if ($scope.user.password.length >= 6) {
                                    $scope.loading = true;
                                    User.create(
                                            $scope.user
                                            ).then(function (response) {
                                        $scope.loading = false;
                                        $state.transitionTo('home.users.main');
                                        $rootScope.kernel.alerts.push({
                                            type: 3,
                                            msg: gettextCatalog.getString('The user has been created'),
                                            priority: 4
                                        });
                                    }).catch(function (response) {
                                        $scope.loading = false;
                                        if (response.data && response.data.errors && response.data.errors.email) {
                                            $rootScope.kernel.alerts.push({
                                                type: 2,
                                                msg: gettextCatalog.getString("This email is already used"),
                                                priority: 3
                                            });
                                        } else if (response.data && response.data.error) {
                                            // Role assignment error from backend
                                            $rootScope.kernel.alerts.push({
                                                type: 1,
                                                msg: response.data.error,
                                                priority: 2
                                            });
                                        } else {
                                            $rootScope.kernel.alerts.push({
                                                type: 1,
                                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                priority: 2
                                            });
                                        }
                                    });
                                } else {
                                    $scope.user.password = "";
                                    $scope.user.passwordConfirmation = "";
                                    $rootScope.kernel.alerts.push({
                                        type: 2,
                                        msg: gettextCatalog.getString("Use at least 6 characters for your password"),
                                        priority: 3
                                    });
                                }
                            } else {
                                $scope.user.password = "";
                                $scope.user.passwordConfirmation = "";
                                $rootScope.kernel.alerts.push({
                                    type: 2,
                                    msg: gettextCatalog.getString("These passwords don't match"),
                                    priority: 3
                                });
                            }
                        } else {
                            $rootScope.kernel.alerts.push({
                                type: 2,
                                msg: gettextCatalog.getString("Please fill all required fields"),
                                priority: 3
                            });
                        }
                    }
                }
            }).catch(function (response) {
                console.error(response);
            });
        });
    });
});
