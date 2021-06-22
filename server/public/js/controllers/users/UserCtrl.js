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
    $scope.rolesList = [
        {name: gettextCatalog.getString('Administrator'), value: '1'},
        {name: gettextCatalog.getString('Global supervisor'), value: '3'},
        {name: gettextCatalog.getString('Manager'), value: '2'},
        {name: gettextCatalog.getString('Editor'), value: '4'},
        {name: gettextCatalog.getString('Simple user'), value: '5'}
    ];
    $scope.loading = false;
    $scope.sending = false;

    $scope.myFilter = function (item) {
        return item.selected;
    };

    $scope.onlyDirection = function (item) {
        return item.rank == "2";
    };

    $ocLazyLoad.load('js/services/UserService.js').then(function () {
        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            var Structure = $injector.get('Structure');
            var User = $injector.get('User');


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
                                        if (response.data.errors.email) {
                                            $rootScope.kernel.alerts.push({
                                                type: 2,
                                                msg: gettextCatalog.getString("This email is already used"),
                                                priority: 3
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
