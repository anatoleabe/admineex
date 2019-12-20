angular.module('PositionCtrl', []).controller('PositionController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";

    $scope.myFilter = function (item) {
        return item.selected;
    };

    $scope.codeAlreadyExist = false;
    $scope.codePosition = "";
    $scope.structure = {};
    $scope.substructure = {};
    $scope.requiredProfiles = [];
    $scope.requiredSKills = [];
    var dictionary = {};


    $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
        var Dictionary = $injector.get('Dictionary');

        Dictionary.jsonList({dictionary: 'structure', levels: ['types']}).then(function (response) {
            $scope.types = response.data.jsonList;
            Dictionary.jsonList({dictionary: 'structure', levels: ['ranks']}).then(function (response) {
                $scope.ranks = response.data.jsonList;
                $ocLazyLoad.load('js/services/StructureService.js').then(function () {
                    var Structure = $injector.get('Structure');
                    $ocLazyLoad.load('js/services/PositionService.js').then(function () {
                        var Position = $injector.get('Position');
                        Dictionary.jsonList({dictionary: "personnel", levels: ['profile']}).then(function (response) {
                            dictionary.profiles = response.data.jsonList;
                            Dictionary.jsonList({dictionary: "personnel", levels: ['skills']}).then(function (response) {
                                dictionary.skills = response.data.jsonList;

                                Structure.minimalList().then(function (response) {
                                    var data = response.data;
                                    $scope.structures = data;

                                    $rootScope.kernel.loading = 100;


                                    $scope.getStructure = function (id) {
                                        $scope.structure = {};
                                        for (var i in $scope.structures){
                                            if ($scope.structures[i]._id == id){
                                                $scope.structure = $scope.structures[i];
                                            }
                                        }
                                    }

                                    $scope.getNextPositionCode = function (subId) {
                                        $scope.substructure = {};
                                        for (var i in $scope.structures){
                                            if ($scope.structures[i]._id == subId){
                                                $scope.substructure = $scope.structures[i];
                                            }
                                        }
                                        if (!$stateParams.id) {
                                            $scope.position.code = $scope.substructure.code + "P";
                                        }
                                    }

                                    $scope.structureFilter = function (item) {
                                        return parseInt(item.rank, 10) < 3;
                                    };

                                    $scope.substructureFilter = function (item) {
                                        if ($scope.structure) {
                                            return item.code.indexOf($scope.structure.code+"-") == 0 && parseInt(item.rank, 10) == 3;
                                        } else {
                                            return false
                                        }
                                    };

                                    $scope.querySearchInResourcesDic = function (text, resourceList) {
                                        var deferred = $q.defer();
                                        if (text) {
                                            var profile = $.grep(dictionary[resourceList], function (c, i) {
                                                return c.name.toLowerCase().includes(text.toLowerCase());
                                            });
                                            deferred.resolve(profile);
                                        } else {
                                            deferred.resolve(dictionary[resourceList]);
                                        }
                                        return deferred.promise;
                                    }

                                    $scope.transformChip = function (chip) {
                                        if (angular.isObject(chip)) {
                                            return chip;
                                        }
                                        return null;
                                    }

                                    function getDictionaryItemByValue(dictionaryList, itemValue) {
                                        var items = $.grep(dictionaryList, function (c, i) {
                                            return c.value === itemValue;
                                        });
                                        if (items && items.length > 0) {
                                            return items[0];
                                        } else {
                                            return undefined;
                                        }
                                    }

                                    function prepareDetailsForServer() {
                                        if ($scope.position) {
                                            var requiredProfiles = [];
                                            if ($scope.requiredProfiles && $scope.requiredProfiles.length > 0) {
                                                for (i = 0; i < $scope.requiredProfiles.length; i++) {
                                                    if ($scope.requiredProfiles[i]) {
                                                        requiredProfiles.push($scope.requiredProfiles[i].id);
                                                    }
                                                }
                                            }

                                            $scope.position.requiredProfiles = requiredProfiles;
                                            var requiredSkills = [];
                                            if ($scope.requiredSkills && $scope.requiredSkills.length > 0) {
                                                for (i = 0; i < $scope.requiredSkills.length; i++) {
                                                    if ($scope.requiredSkills[i]) {
                                                        requiredSkills.push($scope.requiredSkills[i].id);
                                                    }
                                                }
                                            }

                                            $scope.position.requiredSkills = requiredSkills;
                                        }
                                    }

                                    function prepareDetailsForAngular() {
                                        $scope.requiredProfiles = [];
                                        $scope.requiredSkills = [];
                                        if ($scope.position) {
                                            if ($scope.position.requiredProfiles) {
                                                for (i = 0; i < $scope.position.requiredProfiles.length; i++) {
                                                    if ($scope.position.requiredProfiles [i]) {
                                                        $scope.requiredProfiles.push(getDictionaryItemByValue(dictionary.profiles, $scope.position.requiredProfiles[i]));
                                                    }
                                                }
                                            }
                                            if ($scope.position.requiredSkills) {
                                                for (i = 0; i < $scope.position.requiredSkills.length; i++) {
                                                    if ($scope.position.requiredSkills [i]) {
                                                        $scope.requiredSkills.push(getDictionaryItemByValue(dictionary.skills, $scope.position.requiredSkills[i]));
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    $scope.validateCode = function () {
                                        if ($scope.substructure && $scope.position.code && $scope.position.code.startsWith($scope.substructure.code + "P")) {
                                            Position.find({
                                                code: $scope.position.code
                                            }).then(function (response) {
                                                var fundPosition = response.data;
                                                if (fundPosition && fundPosition.code) {
                                                    $mdDialog.show(
                                                            $mdDialog.alert()
                                                            .parent(angular.element(document.querySelector('#popupContainer')))
                                                            .clickOutsideToClose(true)
                                                            .title('This code: "' + $scope.position.code + '"  is already used')
                                                            .textContent('Position: ' + fundPosition.name + " \nStructure: " + fundPosition.structure.name +
                                                                    ' \nPlease choose another position code before continue')
                                                            .ariaLabel('Alert Dialog code')
                                                            .ok('Got it!')
                                                            );
                                                    return false;

                                                } else {
                                                    return true;
                                                }
                                            }).catch(function (response) {
                                                $rootScope.kernel.alerts.push({
                                                    type: 1,
                                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                    priority: 2
                                                });
                                                console.error(response);
                                                return false;
                                            });
                                        } else {
                                            $mdDialog.show(
                                                    $mdDialog.alert()
                                                    .parent(angular.element(document.querySelector('#popupContainer')))
                                                    .clickOutsideToClose(true)
                                                    .title('The position code entered is not valid')
                                                    .textContent('Please enter a correct code. Ex: 191-P1')
                                                    .ariaLabel('Alert Dialog code')
                                                    .ok('Got it!')
                                                    );
                                            return false;
                                        }




                                    }

                                    var watch = {position: {}};
                                    watch.position.code = $scope.$watch("position.code", function (newValue, oldValue) {
                                        if (oldValue && newValue && $scope.substructure) {
                                            if (newValue.length < ($scope.substructure.code.length + 1)) {
                                                $scope.position.code = oldValue;
                                            }
                                        }
                                    });
                                    $scope.$on('$destroy', function () {// in case of directive destroy, we destroy the watch
                                        watch.position.code();
                                    });

                                    // Modify or Add ?
                                    if ($stateParams.id !== undefined) {
                                        $scope.new = false;
                                        Position.read({
                                            id: $stateParams.id
                                        }).then(function (response) {
                                            $scope.position = response.data;
                                            $scope.structure = JSON.parse(JSON.stringify(response.data.structure)).father;
                                            $scope.substructure = JSON.parse(JSON.stringify(response.data.structure));
                                            console.log($scope.structure);
                                            prepareDetailsForAngular();
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
                                        $scope.position = {};
                                        $scope.position.requiredProfiles = [];
                                        $scope.position.requiredSkills = [];
                                        $scope.position.activities = [];
                                        $scope.position.tasks = [];

                                    }

                                    // Add or edit new structure
                                    $scope.submit = function () {
                                        if ($scope.validateCode) {
                                            prepareDetailsForServer();

                                            $rootScope.kernel.loading = 0;
                                            $scope.position.structureId = $scope.substructure._id;
                                            $scope.position.requiredEffective = "1";//Default effective
                                            $scope.position.en = $scope.position.fr;
                                            Position.upsert($scope.position).then(function (response) {
                                                $rootScope.kernel.loading = 100;
                                                $state.go('home.administration.positions');
                                                $rootScope.kernel.alerts.push({
                                                    type: 3,
                                                    msg: gettextCatalog.getString('The position has been saved'),
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
                                    }
                                });
                            }).catch(function (response) {
                                console.error(response);
                            });
                        });
                    });
                });
            });
        });
    });
});
