angular.module('SituationCtrl', []).controller('SituationController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.personnel = params.personnel;

    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };

    var situation = {};


    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staff = $injector.get('Staff');
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');
            Dictionary.jsonList({dictionary: 'personnel', levels: ['situations']}).then(function (response) {
                $scope.situations = response.data.jsonList;
                Dictionary.jsonList({dictionary: 'acts', levels: ['natures']}).then(function (response) {
                    $scope.natures = response.data.jsonList;


                    $scope.save = function () {
                        $rootScope.kernel.loading = 0;
                        $scope.personnel.situations.push($scope.situation);
                        
                        Staff.upsert($scope.personnel).then(function (response) {
                            $rootScope.kernel.loading = 100;
                            $mdDialog.hide();
                            $rootScope.kernel.alerts.push({
                                type: 3,
                                msg: gettextCatalog.getString('The personnel has been updated'),
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
