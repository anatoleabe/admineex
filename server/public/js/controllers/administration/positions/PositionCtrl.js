angular.module('PositionCtrl', []).controller('PositionController', function ($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";

    $scope.myFilter = function (item) {
        return item.selected;
    };


    $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
        var Dictionary = $injector.get('Dictionary');

        Dictionary.jsonList({dictionary: 'structure', levels: ['types']}).then(function (response) {
            $scope.types = response.data.jsonList;
            Dictionary.jsonList({dictionary: 'structure', levels: ['ranks']}).then(function (response) {
                $scope.ranks = response.data.jsonList;
                $ocLazyLoad.load('js/services/PositionService.js').then(function () {
                    var Position = $injector.get('Position');
                    $rootScope.kernel.loading = 100;
                    // Modify or Add ?
                    if ($stateParams.id !== undefined) {
                        $scope.new = false;
                        Position.read({
                            id: $stateParams.id
                        }).then(function (response) {
                            $scope.structure = response.data;
                        }).catch(function (response) {
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                priority: 2
                            });
                            console.error(response);
                        });
                    } else {
                        $scope.new = true;
                        $scope.title = gettextCatalog.getString('New');
                        $scope.structure = {};
                    }

                    // Add or edit new structure
                    $scope.submit = function () {
                        $rootScope.kernel.loading = 0;
                        $scope.structure.en = $scope.structure.fr;
                        Position.upsert($scope.structure).then(function (response) {
                            $rootScope.kernel.loading = 100;
                            $state.go('home.administration.structures');
                            $rootScope.kernel.alerts.push({
                                type: 3,
                                msg: gettextCatalog.getString('The structure has been saved'),
                                priority: 4
                            });
                        }).catch(function (response) {
                            $rootScope.kernel.loading = 100;
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                priority: 2
                            });
                            console.error(response);
                        });
                    }
                });
            });
        });
    });
});
