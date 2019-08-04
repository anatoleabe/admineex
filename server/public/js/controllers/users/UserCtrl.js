angular.module('UserCtrl', []).controller('UserController', function($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.user = {
        password: "",
        passwordConfirmation: "",
    };

    $scope.languagesList = [
        {name:'English', value:'EN'},
        {name:'Español', value:'ES'},
        {name:'Français', value:'FR'},
        {name:'Português', value:'PT'},
        {name:'Русский', value:'RU'}
    ];
    $scope.rolesList = [
        {name: gettextCatalog.getString('Administrator'), value: '2'},
        {name: gettextCatalog.getString('Simple user'), value: '3'}
    ];
    $scope.loading = false;
    $scope.sending = false;

    $scope.myFilter = function (item) { 
        return item.selected; 
    };

    $ocLazyLoad.load('js/services/UserService.js').then(function() {
        var User = $injector.get('User');
        $rootScope.kernel.loading = 100;

        // Modify or Add ?
        if($stateParams.id !== undefined){
            $scope.new = false;
            $scope.passwordTitle = gettextCatalog.getString('New Password');
            User.read({
                id : $stateParams.id
            }).then(function(response3){
                var data3 = response3.data;

                $scope.user = data3;
                $scope.user.password = "";
                $scope.user.passwordConfirmation = "";
                $scope.title = $scope.user.firstname + ' ' + $scope.user.lastname;
            }).catch(function(response) {
                $rootScope.kernel.alerts.push({
                    type: 1,
                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                    priority: 2
                });
            });

            // Modify a user
            $scope.submit = function(){   
                if($scope.user.password != $scope.user.passwordConfirmation){
                    $rootScope.kernel.alerts.push({
                        type: 2,
                        msg: gettextCatalog.getString("These passwords don't match"),
                        priority: 3
                    });
                } else {
                    $rootScope.kernel.loading = 0;
                    User.update(
                        $scope.user
                    ).then(function(response){
                        $state.transitionTo('home.users.main');
                        $rootScope.kernel.alerts.push({
                            type: 3,
                            msg: gettextCatalog.getString('The user has been updated'),
                            priority: 4
                        });
                        $rootScope.kernel.loading = 100;
                    }).catch(function(response) {
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
            $scope.submit = function(){

                if($scope.user.language != undefined && $scope.user.role != undefined){


                    if($scope.user.password === $scope.user.passwordConfirmation){
                        if($scope.user.password.length >= 6){
                            $scope.loading = true;
                            User.create(
                                $scope.user
                            ).then(function(response){
                                $scope.loading = false;
                                $state.transitionTo('home.users.main');
                                $rootScope.kernel.alerts.push({
                                    type:3,
                                    msg: gettextCatalog.getString('The user has been created'),
                                    priority: 4
                                });
                            }).catch(function(response) {
                                $scope.loading = false;
                                if(response.data.errors.email){
                                    $rootScope.kernel.alerts.push({
                                        type:2,
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
                                type:2,
                                msg: gettextCatalog.getString("Use at least 6 characters for your password"),
                                priority: 3
                            });
                        }
                    } else {
                        $scope.user.password = "";
                        $scope.user.passwordConfirmation = "";
                        $rootScope.kernel.alerts.push({
                            type:2,
                            msg: gettextCatalog.getString("These passwords don't match"),
                            priority: 3
                        });
                    }
                } else {  
                    $rootScope.kernel.alerts.push({
                        type:2,
                        msg: gettextCatalog.getString("Please fill all required fields"),
                        priority: 3
                    });
                }
            }
        }
    });
});
