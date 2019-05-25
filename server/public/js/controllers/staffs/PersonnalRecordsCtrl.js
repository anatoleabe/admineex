angular.module('PersonnalRecordsCtrl', []).controller('PersonnalRecordsController', function ($scope, $window, gettextCatalog, $q, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, $mdDialog) {
    $rootScope.kernel.loading = 100;
    $scope.title = "...";

    $scope.loading = false;
    $scope.sending = false;
    $scope.search = false;

    $scope.personnels = [];
    $scope.personnelSelected = undefined;
    $scope.personnelSearchText = null;
    $scope.selectedPersonnelChange = null;
    $scope.profiles = [];
    $scope.kills = [];
    var dictionary = {};
    $scope.helperNoData = {
        icon: 'event_note',
        title: gettextCatalog.getString("No data found.")
    };


    $scope.helper = {
        icon: 'search',
        title: gettextCatalog.getString("Use input to search for a personnal record")
    };

    $scope.back = function () {
        $state.go("home.staffs.main");
    };

    $scope.edit = function (params) {
        $state.go("home.staffs.edit", params);
    };

    function sortMe(a, b) {
        return new Date(b.dateOf).getTime() - new Date(a.dateOf).getTime();
    }

    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staffs = $injector.get('Staff');
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');
            Dictionary.jsonList({dictionary: "personnel", levels: ['profile']}).then(function (response) {
                dictionary.profiles = response.data.jsonList;
                Dictionary.jsonList({dictionary: "personnel", levels: ['skills']}).then(function (response) {
                    dictionary.skills = response.data.jsonList;
                    function createFilterFor(query) {
                        var lowercaseQuery = query.toLowerCase();
                        return function filterFn(item) {
                            return (item.value.indexOf(lowercaseQuery) === 0);
                        };
                    }

                    //Patient Query search
                    $scope.personnelQuerySearch = function (text) {
                        $scope.personnelSelected = undefined;
                        var deferred = $q.defer();
                        var results = text ? createFilterFor(text) : deferred;
                        Staffs.search({text: text}).then(function (response) {
                            var result = response.data;
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
                        if (personnel) {
                            $scope.personnelSelected = personnel;


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

                            function prepareRequiredItemsToAngular() {
                                var profiles = [];
                                var skills = [];
                                if ($scope.personnelSelected) {
                                    if ($scope.personnelSelected.profiles) {
                                        for (i = 0; i < $scope.personnelSelected.profiles.length; i++) {
                                            if ($scope.personnelSelected.profiles [i]) {
                                                profiles.push(getDictionaryItemByValue(dictionary.profiles, $scope.personnelSelected.profiles[i]));
                                            }
                                        }
                                    }
                                    if ($scope.personnelSelected.skills) {
                                        for (i = 0; i < $scope.personnelSelected.skills.length; i++) {
                                            if ($scope.personnelSelected.skills [i]) {
                                                skills.push(getDictionaryItemByValue(dictionary.skills, $scope.personnelSelected.skills[i]));
                                            }
                                        }
                                    }
                                }
                                $scope.profiles = profiles;
                                $scope.skills = skills;
                            }

                            prepareRequiredItemsToAngular();

                            $scope.add = function (personnel, moreField, resourcesDistionary) {
                                var personnel = personnel;

                                $mdDialog.show({
                                    controller: ['$scope', '$mdDialog', 'personnel', '$q', 'dictionary', 'moreField', 'resourcesDistionary', function ($scope, $mdDialog, personnel, $q, dictionary, moreField, resourcesDistionary) {
                                            $scope.personnel = personnel;
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
                                                if ($scope.personnel) {
                                                    $scope.personnel[moreField] = [];
                                                    for (i = 0; i < $scope.selectedDetails.length; i++) {
                                                        if ($scope.selectedDetails[i]) {
                                                            $scope.personnel[moreField].push($scope.selectedDetails[i].id);
                                                        }
                                                    }
                                                }
                                            }

                                            function prepareDetailsForAngular() {
                                                var requiredDetails = [];
                                                if ($scope.personnel) {
                                                    if ($scope.personnel[moreField]) {
                                                        for (i = 0; i < $scope.personnel[moreField].length; i++) {
                                                            if ($scope.personnel[moreField] [i]) {
                                                                requiredDetails.push(getDictionaryItemByValue(dictionary[resourcesDistionary], $scope.personnel[moreField][i]));
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
                                                $scope.personnel[moreField] = $scope.selectedDetails;
                                                
                                                prepareDetailsForServer();
                                                
                                                var positionToUpdate = {
                                                    _id:$scope.personnel._id,
                                                    identifier:$scope.personnel.identifier
                                                };
                                                positionToUpdate[moreField] = $scope.personnel[moreField];
                                                
                                                Staffs.upsert(positionToUpdate).then(function (response) {
                                                    $mdDialog.hide();
                                                    prepareRequiredItemsToAngular();
                                                    $rootScope.kernel.alerts.push({
                                                        type: 3,
                                                        msg: gettextCatalog.getString('The staff has been updated'),
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
                                        personnel: personnel,
                                        dictionary: dictionary,
                                        moreField: moreField,
                                        resourcesDistionary: resourcesDistionary
                                    }
                                }).then(function (answer) {

                                }, function () {

                                });
                            }


                            //loadsHistory(personnel);
                        } else {
                            $scope.personnelSelected = undefined;
                            $scope.events = [];
                        }
                    }



                    loadsHistory = function (personnel) {
                        staffFactory.history(personnel).then(function (response) {
                            var p = response.data.personnel;
                            $scope.personnelSelected = p;
                            var history = p.history;
                            var events = [];

                            for (var i = 0; i < history.length; i++) {
                                var h = history[i];

                                var event = {
                                    action: h.typeMouvement[0].libelle,
                                    title: h.posteActuel[0].nom,
                                    content: h.posteActuel[0].structure[0].nom,
                                    acte: h.acte[0].nature[0].libelle + " N° " + h.acte[0].numero,
                                    dateOf: h.acte[0].dateCreation
                                };
                                events.push(event);
                            }

                            $scope.events = events;

                        }).catch(function (response) {
                            console.log(response);
                        });
                    }
                });
            });
        });
    });
});
