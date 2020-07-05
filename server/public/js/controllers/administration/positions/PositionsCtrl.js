angular.module('PositionsCtrl', []).controller('PositionsController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope, $q, $http) {
    $ocLazyLoad.load('js/services/PositionService.js').then(function () {
        var Position = $injector.get('Position');
        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            var Structure = $injector.get('Structure');
            var helper = {
                title: gettextCatalog.getString("No position"),
                icon: "account_balance"
            };

            $scope.organizations = [], $scope.helper = [];
            $scope.search = false;
            $scope.filters = {
                status: "-"
            };
            $scope.codeStructure = undefined;
            $scope.total = 0;
            $scope.structures = [];
            $scope.showOnlyVacancies = false;
            $scope.query = {
                limit: 25,
                page: 1,
                order: "code"
            };

            $scope.openMoreMenu = function ($mdOpenMenu) {
                $mdOpenMenu();
            };

            $scope.details = function (params) {
                $state.go("home.administration.details", params);
            };

            $scope.edit = function (params) {
                $state.go("home.administration.edit", params);
            };

            $scope.new = function () {
                $state.go("home.administration.new");
            };

            $scope.toggleVacancies = function () {
                var structureCode = $scope.filters.subStructure ? JSON.parse($scope.filters.subStructure).code : ($scope.filters.structure ? JSON.parse($scope.filters.structure).code : "-1");
                getPositions(structureCode, $scope.showOnlyVacancies ? "0" : "-1");
            };

            $scope.load = function () {
                getPositions();
            };

            function getPositions() {
                var limit = $scope.query.limit;
                var skip = $scope.query.limit * ($scope.query.page - 1);
                var filterParams = {
                    structure: $scope.codeStructure,
                    status: $scope.filters.status
                }
                $scope.helper = [];
                $rootScope.kernel.loading = 0;
                var deferred = $q.defer();
                $scope.promise = deferred.promise;
                Position.list({search: $scope.positionFilter, filters: JSON.stringify(filterParams), limit: limit, skip: skip}).then(function (response) {
                    var data = response.data.data;
                    if (data.length == 0 && $scope.helper.length == 0) {
                        $scope.helper = helper;
                    }
                    $rootScope.kernel.loading = 100;
                    $scope.positions = {
                        data: response.data.data,
                        count: response.data.count
                    };
                    deferred.resolve();
                }).catch(function (response) {
                    console.error(response);
                });
            }
            //// All structures (first -1)
            //// Vacancies and allowed positions (Second -1)
            getPositions(-1, -1);

            $scope.filterByStructure = function (idStructure) {
                getPositions(idStructure, $scope.showOnlyVacancies ? 0 : -1);
            };


            $scope.vacanciesOnly = function (item) {
                if ($scope.showOnlyVacancies == true) {
                    return item.vacancies && item.vacancies > 0;
                } else {
                    return true
                }
            };

            $scope.onlyDirection = function (item) {
                return item.rank == "2";
            };

            $scope.resetForm = function () {
                $scope.filters.structure = undefined;
                $scope.filters.soustructure = undefined;
                $scope.positionFilter = "";
                getPositions("-1", $scope.showOnlyVacancies ? "0" : "-1");
            };

            $scope.onlySubDirection = function (item) {
                if ($scope.filters.structure) {
                    var code = JSON.parse($scope.filters.structure).code;
                    return item.rank == "3" && item.code.indexOf(code + "-") == 0;
                } else {
                    return false;
                }

            };

            $scope.$watch('positionFilter', function (newval, oldval) {
                if (newval) {
                    getPositions();
                }
            });

            var watch = {};

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
                    getPositions();
                }
            });

            watch.subStructure = $scope.$watch('filters.subStructure', function (newval, oldval) {
                if (newval && newval != undefined && newval != "undefined") {
                    newval = JSON.parse(newval).code;
                    if (newval != undefined && newval != "undefined" && newval != "-") {
                        $scope.codeStructure = newval + "P";
                        $scope.codeSubStructureExport = newval;
                    } else {
                        $scope.codeStructure = "-";
                        $scope.codeSubStructureExport = "-";
                    }
                    getPositions();
                }
            });

            watch.gender = $scope.$watch('filters.status', function (newval, oldval) {
                if (newval && oldval && newval != oldval) {
                    getPositions();
                }
            });


            $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                watch.structure();
                watch.subStructure();
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

            $scope.exportPDF = function (type) {
                var code = "-1";

                if ($scope.filters.structure) {
                    var selectedTruct = JSON.parse($scope.filters.structure);
                    code = selectedTruct.code;
                }

                var url = '/api/export/pdf/positions/' + code + '/' + false + '/' + false;
                if (type == "nomenclature") {
                    url = '/api/export/pdf/positions/' + code + '/' + false + '/' + true;
                }
                getNomenclature(url);
            }


            getNomenclature = function (url) {
                $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                    var FileSaver = $injector.get('FileSaver');
                    $rootScope.kernel.loading = 0;
                    var deferred = $q.defer();
                    $scope.promise = deferred.promise;



                    $http({
                        method: 'GET',
                        url: url,
                        headers: {'Content-Type': "application/pdf"},
                        responseType: "arraybuffer"
                    }).then(function (response) {
                        var d = new Blob([response.data], {type: "application/pdf"});
                        FileSaver.saveAs(d, 'List_of_positions_dgtcfm.pdf');
                        $rootScope.kernel.loading = 100;
                        deferred.resolve(response.data);
                    }).catch(function (response) {
                        console.error(response);
                    });
                });

            };

            $scope.download = function () {
                $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                    var FileSaver = $injector.get('FileSaver');
                    $rootScope.kernel.loading = 0;
                    var deferred = $q.defer();
                    $scope.promise = deferred.promise;
                    function jsonBufferToObject(data, headersGetter, status) {
                        var type = headersGetter("Content-Type");
                        if (!type.startsWith("application/json")) {
                            return data;
                        }
                        ;
                        var decoder = new TextDecoder("utf-8");
                        var domString = decoder.decode(data);
                        var json = JSON.parse(domString);
                        return json;
                    }

                    var filterParams = {
                        structure: $scope.codeStructureExport,
                        subStructure: $scope.codeSubStructureExport,
                        status: $scope.filters.status
                    }

                    $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                        var Download = $injector.get('Download');
                        Download.start({
                            method: 'GET',
                            url: '/api/positions/download/' + $scope.positionFilter + '/' + JSON.stringify(filterParams),
                            headers: {'Content-Type': "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
                            transformResponse: jsonBufferToObject
                        }).then(function (response) {
                            console.log(response)
                            var d = new Blob([response.data], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
                            var filename = 'Admineex';
                            FileSaver.saveAs(d, filename + gettextCatalog.getString('Adminex_Staff_Export') + '_' + '.xlsx');
                            $rootScope.kernel.loading = 100;
                            deferred.resolve(response.data);
                        }).catch(function (response) {
                            console.error(response);
                            if (response.data && response.data.error === '9500') {
                                $rootScope.kernel.alerts.push({
                                    type: 1,
                                    msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                    priority: 1
                                });
                                $rootScope.kernel.loading = 100;
                            }
                        });
                    });
                });
            }


        });
    });
});
