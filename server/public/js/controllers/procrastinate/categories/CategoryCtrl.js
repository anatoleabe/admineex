angular.module('CategoryCtrl', []).controller('CategoryController', function($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.category = {
        
    }

    $scope.myFilter = function (item) { 
        return item.selected; 
    };
    
    $rootScope.kernel.loading = 100;

    $ocLazyLoad.load('js/services/UserService.js').then(function() {
        var User = $injector.get('User');
        User.list().then(function(response){
            $scope.users = response.data;
            $ocLazyLoad.load('js/services/CategoryService.js').then(function() {
                var Category = $injector.get('Category');
                $rootScope.kernel.loading = 100;

                // Modify or Add ?
                if($stateParams.id !== undefined){
                    $scope.new = false; 
                    Category.read({
                        id : $stateParams.id
                    }).then(function(response){
                        $scope.category = response.data;
                    }).catch(function(response) {
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                        console.error(response);
                    });

                    // Modify an Category
                    $scope.submit = function(){   
                        $rootScope.kernel.loading = 0;
                        Category.upsert(
                            $scope.category
                        ).then(function(response){
                            $state.transitionTo('home.tasks.categories');
                            $rootScope.kernel.alerts.push({
                                type: 3,
                                msg: gettextCatalog.getString('The category has been updated'),
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
                            console.error(response);
                        });
                    }
                } else {
                    $scope.new = true;
                    $scope.title = gettextCatalog.getString('New');

                    // Add a new category
                    $scope.submit = function(){
                        $scope.loading = 0;
                        Category.upsert(
                            $scope.category
                        ).then(function(response){
                            $scope.loading = 100;
                            $state.transitionTo('home.tasks.categories');
                            $rootScope.kernel.alerts.push({
                                type:3,
                                msg: gettextCatalog.getString('The category has been created'),
                                priority: 4
                            });
                        }).catch(function(response) {
                            $scope.loading = 100;
                            console.error(response);
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                priority: 2
                            });
                        });
                    }
                }
            });
        }).catch(function(response) {
            console.error(response);
        });
    });
});
