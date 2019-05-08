angular.module('StructureCtrl', []).controller('StructureController', function ($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";

    $scope.myFilter = function (item) {
        return item.selected;
    };


    $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
        var Dictionary = $injector.get('Dictionary');

        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            var Structure = $injector.get('Structure');
            $rootScope.kernel.loading = 100;
            console.log("jsjsj")
            // Modify or Add ?
//            if ($stateParams.id !== undefined) {
//                $scope.new = false;
//                Structure.read({
//                    id: $stateParams.id,
//                }).then(function (response) {
//                    $scope.structure = response.data;
//                }).catch(function (response) {
//                    $rootScope.kernel.alerts.push({
//                        type: 1,
//                        msg: gettextCatalog.getString('An error occurred, please try again later'),
//                        priority: 2
//                    });
//                    console.error(response);
//                });
//
//                // Modify a Structure
//                $scope.submit = function () {
//                    $rootScope.kernel.loading = 0;
//                    Structure.upsert(
//                            $scope.structure
//                            ).then(function (response) {
//                        $state.transitionTo('home.structures.main');
//                        $rootScope.kernel.alerts.push({
//                            type: 3,
//                            msg: gettextCatalog.getString('The structure has been updated'),
//                            priority: 4
//                        });
//                        $rootScope.kernel.loading = 100;
//                    }).catch(function (response) {
//                        $rootScope.kernel.loading = 100;
//                        $rootScope.kernel.alerts.push({
//                            type: 1,
//                            msg: gettextCatalog.getString('An error occurred, please try again later'),
//                            priority: 2
//                        });
//                        console.error(response);
//                    });
//                }
//            } else {
//                $scope.new = true;
//                $scope.title = gettextCatalog.getString('New');
//
//                // Add a new structure
//                $scope.submit = function () {
//                    $scope.loading = 0;
//                    Structure.upsert(
//                            $scope.structure
//                            ).then(function (response) {
//                        $scope.loading = 100;
//                        $state.transitionTo('home.structures.main');
//                        $rootScope.kernel.alerts.push({
//                            type: 3,
//                            msg: gettextCatalog.getString('The structure has been created'),
//                            priority: 4
//                        });
//                    }).catch(function (response) {
//                        $scope.loading = 100;
//                        console.error(response);
//                        $rootScope.kernel.alerts.push({
//                            type: 1,
//                            msg: gettextCatalog.getString('An error occurred, please try again later'),
//                            priority: 2
//                        });
//                    });
//                }
//            }
        });
    });
});
