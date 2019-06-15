angular.module('EvaluationCtrl', []).controller('EvaluationController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;

    $scope.notations = {
    };

    $scope.loading = false;
    $scope.sending = false;
    $scope.personnels = [];
    $scope.postes = [];

    $scope.searchTerm = "";

    $scope.stopPropagation = function (event) {
        event.stopPropagation();
    };

    $scope.personnelSelected = undefined;
    $scope.personnelSearchText = null;
    $scope.selectedPersonnelChange = null;
    $scope.selectedPersonnel = null;
    $scope.selectedPersonnelStructureactuel = null;
    $scope.year = (new Date()).getFullYear();

    function createFilterFor(query) {
        var lowercaseQuery = angular.lowercase(query);
        return function filterFn(item) {
            return (item.value.indexOf(lowercaseQuery) === 0);
        };
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
                Dictionary.jsonList({dictionary: 'time', levels: ['quarters']}).then(function (response) {
                    $scope.quarters = response.data.jsonList;
                    Dictionary.jsonList({dictionary: 'monitor', levels: ['appreciations']}).then(function (response) {
                        $scope.appreciations = response.data.jsonList;
                        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
                            var Structure = $injector.get('Structure');
                            $ocLazyLoad.load('js/services/PositionService.js').then(function () {
                                var Position = $injector.get('Position');
                                $ocLazyLoad.load('js/services/StaffService.js').then(function () {
                                    var Staff = $injector.get('Staff');

                                    Structure.list().then(function (response) {
                                        var data = response.data;
                                        $scope.structures = data;
                                    }).catch(function (response) {
                                        console.error(response);
                                    });

                                    $scope.loadStaff = function () {
                                        $scope.selectedPersonnel = undefined;
                                        $rootScope.kernel.loading = 0;
                                        Staff.list({minify: true}).then(function (response) {
                                            var data = response.data;
                                            $scope.personnels = data;
                                            $rootScope.kernel.loading = 100;
                                        });
                                    }

                                    $scope.checkSelectedAgent = function () {
                                        var notations = JSON.parse($scope.selectedPersonnel).notations;
                                        if (notations && notations.length > 0) {
                                            for (var i = 0; i < notations.length; i++) {
                                                $scope.quarters = $scope.quarters.filter(function (item) {
                                                    return !(item.id == notations[i].quarter && notations[i].year == $scope.year);
                                                });
                                            }
                                        }
                                    }

                                    $scope.onlyThisStructure = function (item) {
                                        if ($scope.notation && item.affectedTo && item.affectedTo.position && item.affectedTo.position.structure && $scope.notation.structure == item.affectedTo.position.structure._id) {
                                            return true;
                                        } else {
                                            return false;
                                        }
                                    };

                                    $scope.loadStaff();

                                    // Modify or Add ?
                                    if ($scope.params) {

                                    }

                                    // save
                                    $scope.save = function () {
                                        $scope.personnel = newval = JSON.parse($scope.selectedPersonnel);

                                        if (!$scope.personnel.notations) {
                                            $scope.personnel.notations = [];
                                        }
                                        if ($scope.personnel && $scope.personnel.affectedTo && $scope.personnel.affectedTo.position) {
                                            $scope.notation.position = $scope.personnel.affectedTo.position._id;
                                            $scope.notation.year = (new Date()).getFullYear();
                                            ;
                                            $scope.personnel.notations.push($scope.notation);
                                            console.log($scope.personnel);

                                            $rootScope.kernel.loading = 0;

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

                                        } else {
                                            $rootScope.kernel.loading = 100;
                                            $rootScope.kernel.alerts.push({
                                                type: 1,
                                                msg: gettextCatalog.getString('You can not evaluate this agent. Position is needed'),
                                                priority: 2
                                            });
                                        }
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
