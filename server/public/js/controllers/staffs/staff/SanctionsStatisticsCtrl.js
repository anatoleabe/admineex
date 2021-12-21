angular.module('SanctionsStatisticsCtrl', []).controller('SanctionsStatisticsController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.params = params;
    $scope.sanctions = []


    $scope.filters = {
        status: "-"
    };
    $scope.loadingChart = false;
    $rootScope.kernel.loading = 100;

    $scope.helper = {
        title: gettextCatalog.getString("No sanction found"),
    };
    
    $rootScope.showGlobalView = false;

    $ocLazyLoad.load('js/services/SanctionService.js').then(function () {
        var Sanction = $injector.get('Sanction');
        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            var Structure = $injector.get('Structure');
            $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
                var Dictionary = $injector.get('Dictionary');
                Dictionary.jsonList({dictionary: 'personnel', levels: ['sanctions']}).then(function (response) {
                    $scope.sanctionTypes = response.data.jsonList;
                    Dictionary.jsonList({dictionary: 'personnel', levels: ['status']}).then(function (response) {
                        $scope.staffStatusList = response.data.jsonList;


                        $scope.getSanctions = function () {
                            $scope.loadingChart = false;
                        }
                        $scope.getSanctions();
                        

                        $scope.onlyDirection = function (item) {
                            return item.rank == "2";
                        };

                        $scope.resetForm = function () {
                            $scope.filters.structure = undefined;
                            $scope.filters.soustructure = undefined;
                            $scope.sanctionFilter = "";
                            $scope.getSanctions("-1");
                        };

                        $scope.onlySubDirection = function (item) {
                            if ($scope.filters.structure) {
                                var code = JSON.parse($scope.filters.structure).code;
                                return item.rank == "3" && item.code.indexOf(code + "-") == 0;
                            } else {
                                return false;
                            }
                        };


                        var watch = {};
                        watch.search = $scope.$watch('search', function (newval, oldval) {
                            if (newval) {
                                $scope.getSanctions();
                            }
                        });

                        watch.sanctiontype = $scope.$watch('filters.sanctiontype', function (newval, oldval) {
                            if (newval) {
                                if (newval != "-1" && $scope.filters.status && $scope.filters.status != "-") {
                                    Dictionary.jsonList({dictionary: 'personnel', levels: ['sanctions', $scope.filters.status, newval]}).then(function (response) {
                                        $scope.sanctions = response.data.jsonList;
                                    });
                                }

                                $scope.sanctions = [];
                                $scope.filters.sanction = undefined;
                                $scope.getSanctions();
                            }
                        });

                        watch.structure = $scope.$watch('filters.structure', function (newval, oldval) {
                            if (newval) {
                                newval = JSON.parse(newval).code;
                                if (newval != undefined && newval != "undefined" && newval != "-") {
                                    $scope.codeStructure = newval + "-";
                                    $scope.codeStructureExport = newval;
                                    $scope.filters.subStructure = undefined
                                    $scope.codeSubStructureExport = "-1";
                                } else {
                                    $scope.codeStructure = "-";
                                    $scope.codeStructureExport = "-1";
                                    $scope.codeSubStructureExport = "-1";
                                }
                                $scope.getSanctions();
                            }
                        });

                        watch.subStructure = $scope.$watch('filters.subStructure', function (newval, oldval) {
                            if (newval != undefined && newval != "undefined") {
                                newval = JSON.parse(newval).code;
                                if (newval != undefined && newval != "undefined" && newval != "-") {
                                    $scope.codeStructure = newval + "P";
                                    $scope.codeSubStructureExport = newval;
                                } else {
                                    $scope.codeStructure = "-";
                                    $scope.codeSubStructureExport = "-";
                                }
                                $scope.getSanctions();
                            }
                        });

                        watch.status = $scope.$watch('filters.status', function (newval, oldval) {
                            if (newval && newval != oldval) {

                                $scope.sanctions = [];
                                $scope.filters.sanctiontype = undefined;
                                $scope.filters.sanction = undefined;

                                $scope.getSanctions();
                            }
                        });

                        watch.sanction = $scope.$watch('filters.sanction', function (newval, oldval) {
                            if (newval && newval != oldval) {
                                $scope.getSanctions();
                            }
                        });
                        
                        
                        watch.range = $rootScope.$watch('range', function (newValue, oldValue) {
                            if (newValue.from.value.getTime() !== oldValue.from.value.getTime() || newValue.to.value.getTime() !== oldValue.to.value.getTime()) {
                                $scope.loadingChart = false;
                                console.log("rannnnn")
                                $scope.getSanctions();
                            }
                        }, true);


                        $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                            watch.structure();
                            watch.subStructure();
                            watch.sanction();
                            watch.sanctiontype();
                            watch.search();
                            watch.status();
                            watch.range();
                        });
                        $scope.loadingChart = false;

                    });
                });
            });
        });
    });
});
