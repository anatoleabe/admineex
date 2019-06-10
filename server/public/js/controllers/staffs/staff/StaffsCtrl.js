angular.module('StaffsCtrl', []).controller('StaffsController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var StaffAgent = $injector.get('Staff');
        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            var Structure = $injector.get('Structure');
            var helper = {
                title: gettextCatalog.getString("No project"),
                icon: "class"
            };
            $scope.query = {
                limit: 50,
                page: 1,
                order: "name"
            };
            $scope.search = false;
            $scope.filters = {};

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


            $scope.$watch('filters.structure', function (newval, oldval) {
                if (newval) {
                    newval = JSON.parse(newval).code;
                    if (newval && newval != "-1") {
                        $scope.staffsFilter = newval + "-P";
                    }

                }
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

            function getAgents() {
                $scope.helper = [];
                StaffAgent.list({minify: true}).then(function (response) {
                    var data = response.data;
                    if (data.length == 0 && $scope.helper.length == 0) {
                        $scope.helper = helper;
                    }
                    $rootScope.kernel.loading = 100;
                    $scope.personnels = data;

                }).catch(function (response) {
                    console.log(response);
                });
            }
            getAgents();


            function deleteAgent(id) {
                StaffAgent.delete({
                    id: id
                }).then(function (response) {
                    getAgents();
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
            Structure.list().then(function (response) {
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
        });
    });
});
