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
    var dictionary = {};


    $ocLazyLoad.load('js/services/PositionService.js').then(function () {
        var Position = $injector.get('Position');
        $rootScope.kernel.loading = 100;
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');
            Dictionary.jsonList({dictionary: "personnel", levels: ['profile']}).then(function (response) {
                dictionary.profiles = response.data.jsonList;

                Position.read({id: id}).then(function (response) {
                    var data = response.data;
                    $scope.position = data;
                    
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

                    function prepareDetailsForAngular() {
                        var requiredProfiles = [];
                        if ($scope.position.details) {
                            if ($scope.position.details.requiredProfiles) {
                                for (i = 0; i < $scope.position.details.requiredProfiles.length; i++) {
                                    if ($scope.position.details.requiredProfiles [i]) {
                                        requiredProfiles.push(getDictionaryItemByValue(dictionary.profiles, $scope.position.details.requiredProfiles[i]));
                                    }
                                }
                            }
                        }
                        return requiredProfiles;
                    }

                    $scope.requiredProfiles = prepareDetailsForAngular();

                    $scope.add = function (position) {
                        var positionDetail = position.details;

                        $mdDialog.show({
                            controller: ['$scope', '$mdDialog', 'positionDetail', '$q', 'dictionary', function ($scope, $mdDialog, positionDetail, $q, dictionary) {
                                    $scope.positionDetail = positionDetail;

                                    function prepareDetailsForServer() {
                                        if ($scope.positionDetail) {
                                            $scope.positionDetail.requiredProfiles = [];
                                            for (i = 0; i < $scope.selectedProfiles.length; i++) {
                                                if ($scope.selectedProfiles[i]) {
                                                    $scope.positionDetail.requiredProfiles.push($scope.selectedProfiles[i].id);
                                                }
                                            }
                                        }
                                    }
                                    $scope.selectedProfiles = prepareDetailsForAngular();

                                    $scope.querySearchInProfiles = function (text) {
                                        var deferred = $q.defer();
                                        if (text) {
                                            var profile = $.grep(dictionary.profiles, function (c, i) {
                                                return c.name.toLowerCase().includes(text.toLowerCase());
                                            });
                                            deferred.resolve(profile);
                                        } else {
                                            deferred.resolve(dictionary.profiles);
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
                                        $scope.positionDetail.requiredProfiles = $scope.selectedProfiles;
                                        prepareDetailsForServer();
                                        Position.upsert($scope.positionDetail).then(function (response) {
                                            $mdDialog.hide();
                                            $rootScope.kernel.alerts.push({
                                                type: 3,
                                                msg: gettextCatalog.getString('The profile has been edited'),
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
                            templateUrl: '../templates/dialogs/profile.html',
                            parent: angular.element(document.body),
                            clickOutsideToClose: true,
                            locals: {
                                positionDetail: positionDetail,
                                dictionary: dictionary
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
