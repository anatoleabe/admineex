angular.module('PositionDetailsCtrl', []).controller('PositionDetailsController', function ($scope, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $mdDialog, params) {
    $rootScope.kernel.loading = 0;
    var id = params && params.id ? params.id : $stateParams.id;
    $scope.params = params;
    $scope.title = "...";
    $scope.position = {

    }

    $scope.loading = false;
    $scope.sending = false;
    $scope.cities = [];
    $scope.states = [];
    $scope.position = {};
    $scope.requiredProfiles = [];
    $scope.requiredSKills = [];
    $scope.affectedStaffs = [];
    var dictionary = {};
    $scope.helper = {
        icon: 'event_note',
        title: gettextCatalog.getString("No data found.")
    };


    $scope.showHelder = function (params) {
        $state.go("home.staffs.personnalrecords", {id: params._id, opath: "home.staffs.main"});
    };
    
    $ocLazyLoad.load('js/services/PositionService.js').then(function () {
        var Position = $injector.get('Position');
        $rootScope.kernel.loading = 100;
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');
            Dictionary.jsonList({dictionary: "personnel", levels: ['profile']}).then(function (response) {
                dictionary.profiles = response.data.jsonList;
                Dictionary.jsonList({dictionary: "personnel", levels: ['skills']}).then(function (response) {
                    dictionary.skills = response.data.jsonList;

                    Position.read({id: id}).then(function (response) {
                        var data = response.data;
                        $scope.position = data;
                        if ($scope.position && $scope.position.occupiedBy) {
                            var positionHelder = {
                                _id: $scope.position.occupiedBy.personnel._id,
                                name: $scope.position.occupiedBy.personnel.name.family + " " + $scope.position.occupiedBy.personnel.name.given,
                                matricule: $scope.position.occupiedBy.personnel.identifier
                            };
                            $scope.affectedStaffs.push(positionHelder);
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

                        function prepareRequiredItems() {
                            var requiredProfiles = [];
                            var requiredSkills = [];
                            var tasks = [];
                            var activities = [];
                            if ($scope.position) {
                                if ($scope.position.requiredProfiles) {
                                    for (i = 0; i < $scope.position.requiredProfiles.length; i++) {
                                        if ($scope.position.requiredProfiles [i]) {
                                            requiredProfiles.push(getDictionaryItemByValue(dictionary.profiles, $scope.position.requiredProfiles[i]));
                                        }
                                    }
                                }
                                if ($scope.position.requiredSkills) {
                                    for (i = 0; i < $scope.position.requiredSkills.length; i++) {
                                        if ($scope.position.requiredSkills [i]) {
                                            requiredSkills.push(getDictionaryItemByValue(dictionary.skills, $scope.position.requiredSkills[i]));
                                        }
                                    }
                                }
                                if ($scope.position.tasks) {
                                    for (i = 0; i < $scope.position.tasks.length; i++) {
                                        if ($scope.position.tasks [i]) {
                                            tasks.push($scope.position.tasks [i]);
                                        }
                                    }
                                }
                                if ($scope.position.activities) {
                                    for (i = 0; i < $scope.position.activities.length; i++) {
                                        if ($scope.position.activities [i]) {
                                            tasks.push($scope.position.activities [i]);
                                        }
                                    }
                                }
                            }
                            $scope.requiredProfiles = requiredProfiles;
                            $scope.requiredSkills = requiredSkills;
                            $scope.tasks = tasks;
                            $scope.activities = activities;
                        }

                        prepareRequiredItems();

                        $scope.back = function () {
                            $state.go("home.administration.positions");
                        }


                        $scope.edit = function (params) {
                            $state.go("home.administration.edit", params);
                        };

                        $scope.add = function (position, detailField, resourcesDistionary) {
                            var positionDetail = position;


                            $mdDialog.show({
                                controller: ['$scope', '$mdDialog', 'positionDetail', '$q', 'dictionary', 'detailField', 'resourcesDistionary', function ($scope, $mdDialog, positionDetail, $q, dictionary, detailField, resourcesDistionary) {
                                        $scope.positionDetail = positionDetail;
                                        $scope.detailDescription = {};
                                        $scope.detailDescription.name = resourcesDistionary;
                                        if (resourcesDistionary == "profiles") {
                                            $scope.detailDescription.title = gettextCatalog.getString("Select profiles (You can add up to 05 profiles):");
                                            $scope.detailDescription.placeholder = gettextCatalog.getString("Choose profile");
                                        } else if (resourcesDistionary == "skills") {
                                            $scope.detailDescription.title = gettextCatalog.getString("Select skills (You can add up to 05 skills):");
                                            $scope.detailDescription.placeholder = gettextCatalog.getString("Choose a skill");
                                        }


                                        function prepareDetailsForServer() {
                                            if ($scope.positionDetail) {
                                                $scope.positionDetail[detailField] = [];
                                                for (i = 0; i < $scope.selectedDetails.length; i++) {
                                                    if ($scope.selectedDetails[i]) {
                                                        $scope.positionDetail[detailField].push($scope.selectedDetails[i].id);
                                                    }
                                                }
                                            }
                                        }

                                        function prepareDetailsForAngular() {
                                            var requiredDetails = [];
                                            if ($scope.positionDetail) {
                                                if ($scope.positionDetail[detailField]) {
                                                    for (i = 0; i < $scope.positionDetail[detailField].length; i++) {
                                                        if ($scope.positionDetail[detailField] [i]) {
                                                            requiredDetails.push(getDictionaryItemByValue(dictionary[resourcesDistionary], $scope.positionDetail[detailField][i]));
                                                        }
                                                    }
                                                }
                                            }
                                            $scope.selectedDetails = requiredDetails;
                                        }

                                        prepareDetailsForAngular();

                                        $scope.querySearchInProfiles = function (text) {
                                            var deferred = $q.defer();
                                            if (text) {
                                                var profile = $.grep(dictionary[resourcesDistionary], function (c, i) {
                                                    return c.name.toLowerCase().includes(text.toLowerCase());
                                                });
                                                deferred.resolve(profile);
                                            } else {
                                                deferred.resolve(dictionary[resourcesDistionary]);
                                            }
                                            return deferred.promise;
                                        }

                                        $scope.transformChip = function (chip) {
                                            // If it is an object, it's already a known chip
                                            if (angular.isObject(chip)) {
                                                return chip;
                                            }
                                            // Otherwise, return null;
                                            return null;
                                        }

                                        ;
                                        $scope.close = function () {
                                            $mdDialog.hide();
                                        }
                                        $scope.cancel = function () {
                                            $mdDialog.cancel();
                                        };
                                        $scope.save = function (params) {
                                            $scope.positionDetail[detailField] = $scope.selectedDetails;
                                            $scope.position = positionDetail;
                                            prepareDetailsForServer();
                                            Position.upsert($scope.positionDetail).then(function (response) {
                                                $mdDialog.hide();
                                                prepareRequiredItems()
                                                $rootScope.kernel.alerts.push({
                                                    type: 3,
                                                    msg: gettextCatalog.getString('The position has been updated'),
                                                    priority: 4
                                                });
                                            }).catch(function (response) {
                                                $rootScope.kernel.loading = 100;
                                                $rootScope.kernel.alerts.push({
                                                    type: 1,
                                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                    priority: 2
                                                });
                                            });
                                        };

                                    }],
                                templateUrl: '../templates/dialogs/detail.html',
                                parent: angular.element(document.body),
                                clickOutsideToClose: true,
                                locals: {
                                    positionDetail: positionDetail,
                                    dictionary: dictionary,
                                    detailField: detailField,
                                    resourcesDistionary: resourcesDistionary
                                }
                            }).then(function (answer) {

                            }, function () {

                            });

                        }

                        $scope.affectTo = function (position) {

                            $ocLazyLoad.load('js/controllers/administration/positions/AffectationCtrl.js').then(function () {
                                $mdDialog.show({
                                    controller: 'AffectationController',
                                    templateUrl: '../templates/dialogs/affectation.html',
                                    parent: angular.element(document.body),
                                    clickOutsideToClose: true,
                                    locals: {
                                        params: {
                                            positionTo: position,
                                        }
                                    }
                                }).then(function (answer) {
                                }, function () {
                                });
                            });
                        }

                        $scope.eligibility = function (position) {

                            $ocLazyLoad.load('js/controllers/administration/positions/EligibilityCtrl.js').then(function () {
                                $mdDialog.show({
                                    controller: 'EligibilityController',
                                    templateUrl: '../templates/dialogs/eligibility.html',
                                    parent: angular.element(document.body),
                                    clickOutsideToClose: true,
                                    locals: {
                                        params: {
                                            position: position
                                        }
                                    }
                                }).then(function (answer) {
                                }, function () {
                                });
                            });
                        }
                    }).catch(function (response) {
                        console.error(response);
                    });

                });
            });
        });
    });
});
