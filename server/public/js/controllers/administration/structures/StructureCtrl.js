angular.module('StructureCtrl', []).controller('StructureController', function ($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";

    $scope.myFilter = function (item) {
        return item.selected;
    };

    $scope.selected = {};
    $scope.addFather = false;
    var firstTime = true;
    $scope.structure = {
        address: [{
                country: "CAF",
                region: undefined,
                department: undefined,
                arrondissement: undefined,
                use: "home"
            }
        ]
    };


    $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
        var Dictionary = $injector.get('Dictionary');

        Dictionary.jsonList({dictionary: 'structure', levels: ['types']}).then(function (response) {
            $scope.types = response.data.jsonList;
            Dictionary.jsonList({dictionary: 'structure', levels: ['ranks']}).then(function (response) {
                $scope.ranks = response.data.jsonList;
                $ocLazyLoad.load('js/services/StructureService.js').then(function () {
                    var Structure = $injector.get('Structure');
                    Structure.minimalList().then(function (response) {
                        var data = response.data;
                        $scope.structures = data;

                        $rootScope.kernel.loading = 100;
                        
                        Dictionary.jsonList({dictionary: 'location', levels: ['countries', 'CAF']}).then(function (response) {
                            var data = response.data;
                            $rootScope.kernel.loading = 100;
                            $scope.regions = data.jsonList;
                            if (!firstTime === true) {
                                $scope.departments = [];
                                $scope.structure.address[0].country = "CAF";
                                $scope.structure.address[0].department = undefined;
                                $scope.structure.address[0].arrondissement = undefined;
                            } else {
                                firstTime = false;
                            }
                        }).catch(function (response) {
                            console.error(response);
                        });

                        var watch = {};
                        watch.region = $scope.$watch('structure.address[0].region', function (newval, oldval) {
                            if (newval) {
                                Dictionary.jsonList({dictionary: 'location', levels: ['countries', "regions", newval]}).then(function (response) {
                                    var data = response.data;
                                    $rootScope.kernel.loading = 100;
                                    $scope.departments = data.jsonList;

                                    if (oldval) {
                                        if (newval !== oldval) {
                                            $scope.structure.address[0].arrondissement = undefined;
                                        }
                                    } else {
                                        if (!$scope.structure.address[0].arrondissement) {
                                            $scope.structure.address[0].arrondissement = undefined;
                                        }
                                    }

                                }).catch(function (response) {
                                    console.error(response);
                                });
                            } else {
                                $scope.structure.address[0].arrondissement = undefined;
                            }
                        });

                        $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                            watch.region();
                        });


                        $rootScope.kernel.loading = 100;
                        // Modify or Add ?
                        if ($stateParams.id !== undefined) {
                            $scope.new = false;
                            Structure.read({
                                id: $stateParams.id
                            }).then(function (response) {
                                $scope.structure = response.data;
                                console.log($scope.structure);
                                $scope.selected.structure = {
                                    _id: $scope.structure.fatherId
                                }
                                if ($scope.structure.rank == "0") {
                                    $scope.addFather = false;
                                } else {
                                    $scope.addFather = true;
                                }
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

                        }


                        $scope.rankChange = function () {
                            $scope.selected.structure = undefined;

                            if ($scope.structure.rank == "0") {
                                $scope.addFather = false;
                            } else {
                                $scope.addFather = true;
                            }
                        };

                        $scope.structureChange = function () {
                            if ($scope.selected.structure) {
                                if (($scope.structure.code && !($scope.structure.code.indexOf(JSON.parse($scope.selected.structure).code) > -1)) || !$scope.structure.code) {
                                    $scope.structure.code = JSON.parse($scope.selected.structure).code + "-";
                                }
                            }
                        };


                        $scope.structureFilter = function (item) {
                            if ($scope.structure) {
                                return parseInt(item.rank, 10) <= parseInt($scope.structure.rank, 10) - 1;
                            } else {
                                return false
                            }
                        };



                        // Add or edit new structure
                        $scope.submit = function () {
                            $rootScope.kernel.loading = 0;
                            $scope.structure.en = $scope.structure.fr;
                            if ($scope.addFather && $scope.selected.structure) {
                                $scope.structure.fatherId = JSON.parse($scope.selected.structure)._id;
                            }

                            Structure.upsert($scope.structure).then(function (response) {
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
});
