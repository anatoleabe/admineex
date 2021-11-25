angular.module('SanctionCtrl', []).controller('SanctionController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.personnel_id = params.personnel._id;
    $scope.personnel_id = params.personnel._id;

    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };

    $scope.sanction = {
        personnelId: $scope.personnel_id
    };
    
    if (params.personnel && params.personnel.affectedTo){
        $scope.sanction.positionId = params.personnel.affectedTo.positionId;
        $scope.sanction.positionCode = params.personnel.affectedTo.positionCode;
    }

    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staff = $injector.get('Staff');
        $ocLazyLoad.load('js/services/SanctionService.js').then(function () {
            var Sanction = $injector.get('Sanction');
            $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
                var Dictionary = $injector.get('Dictionary');
                Dictionary.jsonList({dictionary: 'personnel', levels: ['sanctions']}).then(function (response) {
                    $scope.sanctionTypes = response.data.jsonList.filter(function (el) {
                            if (params.type === "3"){
                                return el.id === "3" ;
                            }else{
                                return el.id !== "3" ;
                            }
                            
                        });
                    
                    Dictionary.jsonList({dictionary: 'time', levels: ['periods']}).then(function (response) {
                        $scope.periods = response.data.jsonList;

                        Dictionary.jsonList({dictionary: 'acts', levels: ['natures']}).then(function (response) {
                            $scope.natures = response.data.jsonList;
                            Staff.read({
                                id: $scope.personnel_id
                            }).then(function (response) {
                                $scope.personnel = response.data;
                                $scope.save = function () {
                                    $rootScope.kernel.loading = 0;
                                    $scope.personnel.sanctions.push($scope.sanction);

                                    Sanction.sanction($scope.sanction).then(function (response) {
                                        $rootScope.kernel.loading = 100;
                                        $mdDialog.hide();
                                        $rootScope.kernel.alerts.push({
                                            type: 3,
                                            msg: gettextCatalog.getString('The saction has been saved'),
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

                                var watch = {};
                                watch.sanctiontype = $scope.$watch('sanction.type', function (newval, oldval) {
                                    if (newval && $scope.personnel) {
                                        Dictionary.jsonList({dictionary: 'personnel', levels: ['sanctions', $scope.personnel.status, newval]}).then(function (response) {
                                            $scope.sanctions = response.data.jsonList;
                                        });
                                        $scope.sanctions = [];
                                        $scope.sanction.sanction = undefined;
                                        $scope.sanction.duration = undefined;
                                        $scope.sanction.period = undefined;
                                    }
                                });
//                                watch.sanction = $scope.$watch('sanction.sanction', function (newval, oldval) {
//                                    if (newval) {
//                                        //$scope.selectedSanctions = _.findWhere($scope.sanctions, {id: newval});
//                                    }
//                                });

                                $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                                    watch.sanctiontype();
                                });
                            }).catch(function (response) {
                                $rootScope.kernel.alerts.push({
                                    type: 1,
                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                    priority: 2
                                });
                                console.error(response);
                            });
                        });
                    });
                });
            });
        });
    });
});
