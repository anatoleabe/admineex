angular.module('StaffsCtrl', []).controller('StaffsController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope, $q, $http) {
    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var StaffAgent = $injector.get('Staff');
        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
                var Dictionary = $injector.get('Dictionary');
                var Structure = $injector.get('Structure');
                Dictionary.jsonList({dictionary: 'personnel', levels: ['situations']}).then(function (response) {
                    $scope.situations = response.data.jsonList;

                    var helper = {
                        title: gettextCatalog.getString("No project"),
                        icon: "class"
                    };
                    $scope.query = {
                        limit: 25,
                        page: 1,
                        order: "name"
                    };
                    $scope.search = false;
                    $scope.filters = {
                        situation: "0",
                        gender: "-",
                        status: "-",
                    };
                    $scope.codeStructure = undefined;
                    $scope.total = 0;

                    $scope.personnels = [], $scope.helper = [];

                    $scope.edit = function (params) {
                        $state.go("home.staffs.edit", params);
                    };

                    $scope.read = function (params) {
                        $state.go("home.staffs.personnalrecords", {id: params._id, opath: "home.staffs.main"});
                    };

                    $scope.filterByStructure = function (structureCode) {
                        $scope.staffsFilter = structureCode;
                    };

                    Dictionary.jsonList({dictionary: 'personnel', levels: ['status']}).then(function (response) {
                        $scope.status = response.data.jsonList;
                    });

                    $scope.retiredOnly = function (item) {
                        if ($scope.showOnlyRetirement == true) {
                            return item.retirement && item.retirement.retirement == true;
                        } else {
                            return true
                        }
                    };

                    $scope.openMoreMenu = function ($mdOpenMenu) {
                        $mdOpenMenu();
                    };


                    $scope.showRetired = function () {
                        $ocLazyLoad.load('js/controllers/staffs/staff/RetiredCtrl.js').then(function () {
                            $mdDialog.show({
                                controller: 'RetiredController',
                                templateUrl: '../templates/dialogs/retireds.html',
                                parent: angular.element(document.body),
                                clickOutsideToClose: true,
                                locals: {
                                    params: {

                                    }
                                }
                            }).then(function (answer) {
                            }, function () {
                            });
                        });
                    }


                    $scope.newStaffSituation = function (personnel) {
                        $ocLazyLoad.load('js/controllers/staffs/staff/SituationCtrl.js').then(function () {
                            $mdDialog.show({
                                controller: 'SituationController',
                                templateUrl: '../templates/dialogs/situation.html',
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


                    $scope.newStaffSanction = function (personnel) {
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

                    $scope.affect = function (personnel) {
                        $ocLazyLoad.load('js/controllers/administration/positions/AffectationCtrl.js').then(function () {
                            $mdDialog.show({
                                controller: 'AffectationController',
                                templateUrl: '../templates/dialogs/affectation.html',
                                parent: angular.element(document.body),
                                clickOutsideToClose: true,
                                locals: {
                                    params: {
                                        personnel: personnel
                                    }
                                }
                            }).then(function (answer) {
//                                    $scope.profile.work[0].organisationID = answer._id;
//                                    $scope.organisationSearchText = answer.name;
//                                    showAlert();
                            }, function () {
                            });
                        });
                    };

                    $scope.evaluate = function (personnel) {
                        $ocLazyLoad.load('js/controllers/monitor/EvaluationCtrl.js').then(function () {
                            $mdDialog.show({
                                controller: 'EvaluationController',
                                templateUrl: '../templates/dialogs/evaluation.html',
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


                    $scope.onlyDirection = function (item) {
                        return item.rank == "2";
                    };

                    $scope.getAgents = function () {
                        $rootScope.kernel.loading = 0;
                        $scope.helper = [];
                        var limit = $scope.query.limit;
                        var skip = $scope.query.limit * ($scope.query.page - 1);
                        var filterParams = {
                            structure: $scope.codeStructure,
                            gender: $scope.filters.gender,
                            status: $scope.filters.status,
                            grade: $scope.filters.grade,
                            category: $scope.filters.category,
                            situation: $scope.filters.situation
                        }
                        StaffAgent.list({minify: true, limit: limit, skip: skip, search: $scope.staffsFilter, filters: JSON.stringify(filterParams)}).then(function (response) {
                            var data = response.data.data;
                            if (data.length == 0 && $scope.helper.length == 0) {
                                $scope.helper = helper;
                            }
                            $rootScope.kernel.loading = 100;
                            $scope.personnels = {
                                data: response.data.data,
                                count: response.data.count
                            };

                        }).catch(function (response) {
                            console.log(response);
                        });
                    }
                    $scope.getAgents();

                    $scope.onlySubDirection = function (item) {
                        if ($scope.filters.structure && $scope.filters.structure != "-") {
                            var code = JSON.parse($scope.filters.structure).code;
                            return item.rank == "3" && item.code.indexOf(code + "-") == 0;
                        } else {
                            return false;
                        }
                    };

                    var watch = {};

                    watch.status = $scope.$watch('filters.status', function (newval, oldval) {
                        if (newval && oldval && newval != oldval) {
                            if (newval != "-") {
                                Dictionary.jsonList({dictionary: 'personnel', levels: ['status', $scope.filters.status, "grades"]}).then(function (response) {
                                    $scope.grades = response.data.jsonList;
                                    $scope.filters.grade = "-";
                                });
                                Dictionary.jsonList({dictionary: 'personnel', levels: ['status', $scope.filters.status, "categories"]}).then(function (response) {
                                    $scope.categories = response.data.jsonList;
                                    $scope.filters.category = "-";
                                });
                            } else {
                                $scope.grades = [];
                                $scope.filters.grade = "-";
                                $scope.categories = [];
                                $scope.filters.category = "-";
                            }
                            $scope.getAgents();
                        } else {
                            $scope.grades = [];
                            $scope.categories = [];
                            if (oldval) {
                                $scope.filters.grade = "-";
                                $scope.filters.category = "-";
                            }
                        }
                    });

                    watch.grades = $scope.$watch('filters.grade', function (newval, oldval) {
                        if (newval && oldval && newval != oldval) {
                            $scope.getAgents();
                        }
                    });

                    watch.category = $scope.$watch('filters.category', function (newval, oldval) {
                        if (newval && oldval && newval != oldval) {
                            $scope.getAgents();
                        }
                    });

                    watch.situation = $scope.$watch('filters.situation', function (newval, oldval) {
                        if (newval && oldval && newval != oldval) {
                            $scope.getAgents();
                        }
                    });

                    watch.structure = $scope.$watch('filters.structure', function (newval, oldval) {
                        if (newval && newval != oldval) {
                            if (newval && newval != "-") {
                                newval = JSON.parse(newval).code;
                                $scope.codeStructure = newval + "-";
                                $scope.codeStructureExport = newval ;
                            } else {
                                $scope.codeStructure = "-";
                                $scope.codeStructureExport = "-1";
                                $scope.filters.subStructure = undefined;

                            }
                            $scope.getAgents();
                        }
                    });

                    watch.staffsFilter = $scope.$watch('staffsFilter', function (newval, oldval) {
                        if (newval) {
                            $scope.getAgents();
                        }
                    });

                    watch.gender = $scope.$watch('filters.gender', function (newval, oldval) {
                        if (newval && oldval && newval != oldval) {
                            $scope.getAgents();
                        }
                    });

                    watch.subStructure = $scope.$watch('filters.subStructure', function (newval, oldval) {
                        if (newval) {
                            if (newval && newval != "-") {
                                newval = JSON.parse(newval).code;
                                $scope.codeStructure = newval;
                                $scope.codeStructureExport = newval;
                            } else {
                                $scope.codeStructure = "-";
                                $scope.codeStructureExport = "-";
                            }
                            $scope.getAgents();
                        }
                    });

                    $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                        watch.structure();
                        watch.subStructure();
                        watch.staffsFilter();
                        watch.grades();
                        watch.status();
                        watch.category();
                        watch.situation();
                    });

                    function deleteAgent(id) {
                        StaffAgent.delete({
                            id: id
                        }).then(function (response) {
                            $scope.getAgents();
                            $rootScope.kernel.alerts.push({
                                type: 3,
                                msg: gettextCatalog.getString('The Agent has been deleted'),
                                priority: 4
                            });
                        }).catch(function (response) {
                            console.log(response);
                        });
                    }


                    //Load structure list
                    Structure.minimalList().then(function (response) {
                        var data = response.data;
                        $scope.structures = data;
                    }).catch(function (response) {
                        console.error(response);
                    });

                    $scope.showConfirm = function (agent) {
                        var confirm = $mdDialog.confirm()
                                .title(gettextCatalog.getString("Delete this Agent"))
                                .textContent(gettextCatalog.getString("Are you sure you want to delete the Agent") + " " + agent.name.use + gettextCatalog.getString("?"))
                                .ok(gettextCatalog.getString("OK"))
                                .cancel(gettextCatalog.getString("Cancel"));

                        $mdDialog.show(confirm).then(function () {
                            // Delete
                            deleteAgent(agent._id)
                        }, function () {
                            // Cancel
                        });
                    }

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
                                gender: $scope.filters.gender,
                                status: $scope.filters.status,
                                grade: $scope.filters.grade,
                                category: $scope.filters.category,
                                situation: $scope.filters.situation
                            }

                            $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                var Download = $injector.get('Download');
                                Download.start({
                                    method: 'GET',
                                    url: '/api/personnel/export/' + $scope.staffsFilter + '/' + JSON.stringify(filterParams),
                                    headers: {'Content-Type': "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
                                    transformResponse: jsonBufferToObject
                                }).then(function (response) {
                                    console.log(response)
                                    var d = new Blob([response.data], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
                                    var filename = 'Admineex';
                                    FileSaver.saveAs(d, filename + gettextCatalog.getString('Adminex_Staff_Export') + '_' +  '.xlsx');
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
    });
});
