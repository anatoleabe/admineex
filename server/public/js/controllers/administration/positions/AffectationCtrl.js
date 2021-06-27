angular.module('AffectationCtrl', []).controller('AffectationController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;

    $scope.affectation = {
        numAct: "",
        positionId: "",
        lastPositionId: undefined,
        current: true,
        signatureDate: undefined,
        startDate: undefined,
        mouvement: undefined,
        nature: undefined
    };

    $scope.loading = true;
    $rootScope.kernel.loading = 0
    $scope.sending = false;
    $scope.personnels = [];
    $scope.postes = [];
    $scope.typeMouvements = [];
    $scope.natturesActe = [];

    $scope.searchTerm = "";

    $scope.stopPropagation = function (event) {
        event.stopPropagation();
    };

    $scope.personnelSelected = undefined;
    $scope.personnelSearchText = null;
    $scope.selectedPersonnelChange = null;
    $scope.selectedPersonnel = null;
    $scope.selectedPersonnelStructureactuel = null;

    function createFilterFor(query) {
        var lowercaseQuery = angular.lowercase(query);
        return function filterFn(item) {
            return (item.value.indexOf(lowercaseQuery) === 0);
        };
    }

    //Patient Query search
    $scope.personnelQuerySearch = function (query) {
        $scope.personnelSelected = undefined;
        var deferred = $q.defer();
        var results = query ? createFilterFor(query) : deferred;
        staffFactory.search(query).then(function (response) {
            var result = response.data.personnels;
            if (!result || result === 'null' | result === null) {
                result = [];
            }
            deferred.resolve(result);
        }).catch(function (response) {
            console.log(response);
        });
        return deferred.promise;
    };

    $scope.selectedPersonnelChange = function (personnel) {
        $scope.selectedPersonnel = personnel;
        if (personnel) {
            if (personnel.posteActuel) {
                $scope.selectedPersonnelPosteActuel = personnel.posteActuel[0].nom;
                $scope.mouvement.idAncienPoste = personnel.posteActuel[0].id;
                if (personnel.posteActuel[0].structurePere) {
                    $scope.selectedPersonnelStructureactuel = personnel.posteActuel[0].structurePere[0].code;
                } else {
                    $scope.selectedPersonnelStructureactuel = "";
                }
            } else {
                $scope.selectedPersonnelPosteActuel = "Inconnue";
            }
            $scope.mouvement.idPersonnel = personnel.id;
        } else {
            $scope.selectedPersonnelPosteActuel = "Inconnue";
            $scope.selectedPersonnelStructureactuel = "";
            $scope.mouvement.idPersonnel = undefined;
        }
    }

    $scope.getPositionCode = function (code) {
        if (code) {
            $scope.affectation.positionCode = code;
        }
    }

    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };


    $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
        var Dictionary = $injector.get('Dictionary');

        Dictionary.jsonList({dictionary: 'structure', levels: ['types']}).then(function (response) {
            $scope.types = response.data.jsonList;
            Dictionary.jsonList({dictionary: 'structure', levels: ['ranks']}).then(function (response) {
                $scope.ranks = response.data.jsonList;
                Dictionary.jsonList({dictionary: 'personnel', levels: ['mouvements']}).then(function (response) {
                    $scope.mouvements = response.data.jsonList;
                    Dictionary.jsonList({dictionary: 'acts', levels: ['natures']}).then(function (response) {
                        $scope.naturesAct = response.data.jsonList;
                        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
                            var Structure = $injector.get('Structure');
                            $ocLazyLoad.load('js/services/PositionService.js').then(function () {
                                var Position = $injector.get('Position');
                                $ocLazyLoad.load('js/services/StaffService.js').then(function () {
                                    var Staff = $injector.get('Staff');
                                    $ocLazyLoad.load('js/services/PositionService.js').then(function () {
                                        var Position = $injector.get('Position');


                                        Staff.list({minify: false}).then(function (response) {
                                            var data = response.data;
                                            $scope.personnels = data.data;
                                            $scope.loading = false;
                                            $rootScope.kernel.loading = 100;


                                            $scope.loadStructures = function (type) {
                                                $scope.loading = true;
                                                $rootScope.kernel.loading = 0;
                                                $scope.structures = undefined;
                                                $scope.structures = undefined;
                                                $scope.affectation.positionId = undefined
                                                var option = {type: "t=" + type};
                                                if (type == 2) {
                                                    option = {type: "t=" + type + "=r=" + 2};
                                                }

                                                Structure.minimalList(option).then(function (response) {
                                                    var data = response.data;
                                                    $scope.structures = data;
                                                    $scope.loading = false;
                                                    $rootScope.kernel.loading = 100;
                                                }).catch(function (response) {
                                                    console.error(response);
                                                });
                                            }

                                            $scope.loadSubStructures = function (type, structureCode) {
                                                $scope.loading = true;
                                                $rootScope.kernel.loading = 0;
                                                $scope.substructures = undefined;
                                                $scope.affectation.positionId = undefined
                                                var option = {type: "t=" + type};
                                                if (type == 2) {
                                                    option = {type: "t=" + type + "=r=" + 3};
                                                }

                                                Structure.minimalList(option).then(function (response) {
                                                    var data = response.data;
                                                    $scope.substructures = data;
                                                    $scope.loading = false;
                                                    $rootScope.kernel.loading = 100
                                                }).catch(function (response) {
                                                    console.error(response);
                                                });
                                            }


                                            $scope.onlySubDirection = function (item) {
                                                if ($scope.structure) {
                                                    var code = $scope.structure;
                                                    return item.rank == "3" && item.code.indexOf(code + "-") == 0;
                                                } else {
                                                    return false;
                                                }
                                            };

                                            var watch = {};

                                            watch.substructure = $scope.$watch('substructure', function (newval, oldval) {
                                                $scope.affectation.positionId = undefined;
                                                if (newval) {
                                                    console.log(newval);
                                                    getPositions(newval);
                                                }
                                            });

                                            $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                                                watch.substructure();
                                            });

                                            function getPositions(idStructure) {
                                                console.log(idStructure);
                                                $scope.helper = [];
                                                $rootScope.kernel.loading = 0;
                                                var deferred = $q.defer();
                                                $scope.promise = deferred.promise;
                                                var filterParams = {
                                                    structure: idStructure
                                                };
                                                
                                                Position.list({filters: JSON.stringify(filterParams)}).then(function (response) {
                                                    var data = response.data.data;
                                                    console.log("data")
                                                    console.log(data)

                                                    $rootScope.kernel.loading = 100;
                                                    $scope.positions = data;
                                                    deferred.resolve();
                                                }).catch(function (response) {
                                                    console.error(response);
                                                });
                                            }
                                            $scope.affectation.isCurrent = true;

                                            // Modify or Add ?
                                            if ($scope.params) {
                                                if ($scope.params.positionTo) {
                                                    $scope.positionFromParams = true;
                                                    $scope.structure = $scope.params.positionTo.structure.code;
                                                    $scope.affectation.positionId = $scope.params.positionTo._id;
                                                    $scope.affectation.positionCode = $scope.params.positionTo.code;
                                                }

                                                if ($scope.params.personnel) {
                                                    $scope.personnelFromParams = true;
                                                    $scope.selectedPersonnel = $scope.params.personnel._id;
                                                }
                                            }

                                            // save
                                            $scope.save = function () {
                                                $rootScope.kernel.loading = 0;
                                                $scope.affectation.occupiedBy = $scope.selectedPersonnel;

                                                Position.affect($scope.affectation).then(function (response) {
                                                    $rootScope.kernel.loading = 100;
                                                    if ($scope.params.positionTo) {
                                                        $state.go('home.administration.positions');
                                                    } else if ($scope.params.personnel) {
                                                        $state.go('home.staffs.main');
                                                    }

                                                    $rootScope.kernel.alerts.push({
                                                        type: 3,
                                                        msg: gettextCatalog.getString('The operation has been saved'),
                                                        priority: 4
                                                    });
                                                    $scope.close();
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
                });
            });
        });

    });
});
