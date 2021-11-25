angular.module('SanctionsManagementCtrl', []).controller('SanctionsManagementController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;
    $scope.sanctions = []

    var helper = {
        title: gettextCatalog.getString("No saction found"),
        icon: "gavel"
    };

    $scope.filters = {
        status: "-"
    };
    $scope.query = {
        limit: 25,
        page: 1,
        order: "-lastModified"
    };

    $scope.helper = {
        title: gettextCatalog.getString("No sanction found"),
    };


    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };

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

                            var deferred = $q.defer();

                            $rootScope.kernel.loading = 0;
                            $scope.helper = [];
                            var limit = $scope.query.limit;
                            var skip = $scope.query.limit * ($scope.query.page - 1);
                            var filterParams = {
                                structure: $scope.codeStructure,
                                status: $scope.filters.status,
                                sanctiontype: $scope.filters.sanctiontype,
                                sanction: $scope.filters.sanction
                            }
                            Sanction.list({limit: limit, skip: skip, search: $scope.search, filters: JSON.stringify(filterParams)}).then(function (response) {
                                var data = response.data;
                                $rootScope.kernel.loading = 100;

                                $scope.sanctionsList = {
                                    data: data,
                                    count: data.length
                                };
                                return deferred.promise;
                            }).catch(function (response) {
                                console.log(response);
                            });
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


                        $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                            watch.structure();
                            watch.subStructure();
                            watch.sanction();
                            watch.sanctiontype();
                            watch.search();
                            watch.status();
                        });

                        //Load structure list
                        Structure.minimalList().then(function (response) {
                            var data = response.data;
                            if (data.length == 0 && $scope.helper.length == 0) {
                                $scope.helper = helper;
                            }
                            $scope.structures = data;
                        }).catch(function (response) {
                            console.error(response);
                        });

                        $scope.newSanction = function (personnel) {
                            $ocLazyLoad.load('js/controllers/staffs/staff/SanctionCtrl.js').then(function () {
                                $mdDialog.show({
                                    controller: 'SanctionController',
                                    templateUrl: '../templates/dialogs/sanction.html',
                                    parent: angular.element(document.body),
                                    clickOutsideToClose: true,
                                    locals: {
                                        params: {
                                            personnel: personnel
                                        }
                                    }
                                }).then(function (answer) {
                                    
                                }, function () {
                                });
                            });
                        }


                        $scope.showConfirm = function (sanction) {
                            var confirm = $mdDialog.confirm()
                                    .title(gettextCatalog.getString("Cancel this sanction"))
                                    .textContent(gettextCatalog.getString("Are you sure you want to cancel the sanction of") + " " + sanction.fame + gettextCatalog.getString("?"))
                                    .ok(gettextCatalog.getString("Delete"))
                                    .cancel(gettextCatalog.getString("Cancel"));

                            $mdDialog.show(confirm).then(function () {
                                // Delete
                                Sanction.delete({
                                    id: sanction._id
                                }).then(function (response) {
                                    $scope.getSanctions();
                                    $rootScope.kernel.alerts.push({
                                        type: 3,
                                        msg: gettextCatalog.getString('The sanction has been canceled successfully'),
                                        priority: 4
                                    });
                                }).catch(function (response) {
                                    console.log(response);
                                });
                            }, function () {
                                // Cancel
                            });
                        }



                    });
                });
            });
        });
    });
});
