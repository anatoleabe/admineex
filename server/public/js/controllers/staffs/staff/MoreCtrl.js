angular.module('MoreCtrl', []).controller('MoreController', function ($scope, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $mdDialog, params) {
    $rootScope.kernel.loading = 0;
    var id = params && params.id ? params.id : $stateParams.id;
    $scope.params = params;
    $scope.title = "...";

    $scope.loading = false;
    $scope.sending = false;
    $scope.profiles = [];
    $scope.kills = [];
    var dictionary = {};
    $scope.helper = {
        icon: 'event_note',
        title: gettextCatalog.getString("No data found.")
    };

    



    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staff = $injector.get('Staff');
        $rootScope.kernel.loading = 100;
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');
            Dictionary.jsonList({dictionary: "personnel", levels: ['profile']}).then(function (response) {
                dictionary.profiles = response.data.jsonList;
                Dictionary.jsonList({dictionary: "personnel", levels: ['skills']}).then(function (response) {
                    dictionary.skills = response.data.jsonList;

                    Staff.read({id: id}).then(function (response) {
                        var data = response.data;
                        $scope.personnel = data;

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
                                            if ($scope.positionDetail) {
                                                $scope.positionDetail[moreField] = [];
                                                for (i = 0; i < $scope.selectedDetails.length; i++) {
                                                    if ($scope.selectedDetails[i]) {
                                                        $scope.positionDetail[moreField].push($scope.selectedDetails[i].id);
                                                    }
                                                }
                                            }
                                        }

                                        function prepareDetailsForAngular() {
                                            var requiredDetails = [];
                                            if ($scope.positionDetail) {
                                                if ($scope.positionDetail[moreField]) {
                                                    for (i = 0; i < $scope.positionDetail[moreField].length; i++) {
                                                        if ($scope.positionDetail[moreField] [i]) {
                                                            requiredDetails.push(getDictionaryItemByValue(dictionary[resourcesDistionary], $scope.positionDetail[moreField][i]));
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
                                            $scope.position = personnel;
                                            prepareDetailsForServer();
                                            Staff.upsert($scope.positionDetail).then(function (response) {
                                                $mdDialog.hide();
                                                prepareRequiredItems();
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
                                    personnel: personnel,
                                    dictionary: dictionary,
                                    moreField: moreField,
                                    resourcesDistionary: resourcesDistionary
                                }
                            }).then(function (answer) {

                            }, function () {

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
