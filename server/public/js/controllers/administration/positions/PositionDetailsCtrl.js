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




    $ocLazyLoad.load('js/services/PositionService.js').then(function () {
        var Position = $injector.get('Position');
        $rootScope.kernel.loading = 100;


        Position.read({id: id}).then(function (response) {
            var data = response.data;
            $scope.position = data;





            $scope.add = function (position) {








                var positionDetail = position.details;
                $mdDialog.show({
                    controller: ['$scope', '$mdDialog', 'positionDetail', '$q', function ($scope, $mdDialog, positionDetail, $q) {
                            $scope.dictionary = {};

                            $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
                                var Dictionary = $injector.get('Dictionary');
                                Dictionary.jsonList({dictionary: "personnel", levels: ['profile']}).then(function (response) {
                                    $scope.dictionary.profiles = response.data.jsonList;
                                    $scope.positionDetail = positionDetail;

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
                                        if ($scope.positionDetail) {
                                            if ($scope.positionDetail.requiredProfiles) {
                                                for (i = 0; i < $scope.positionDetail.requiredProfiles.length; i++) {
                                                    if ($scope.positionDetail.requiredProfiles [i]) {
                                                        $scope.selectedProfiles.push(getDictionaryItemByValue($scope.dictionary.profiles, $scope.positionDetail.requiredProfiles[i]));
                                                    }
                                                }
                                            }
                                        }
                                    }

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

                                    $scope.selectedProfiles = [];
                                    prepareDetailsForAngular();

                                    $scope.querySearchInProfiles = function (text) {
                                        var deferred = $q.defer();
                                        if (text) {
                                            var profile = $.grep($scope.dictionary.profiles, function (c, i) {
                                                return c.name.toLowerCase().includes(text.toLowerCase());
                                            });
                                            deferred.resolve(profile);
                                        } else {
                                            deferred.resolve($scope.dictionary.profiles);
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
                                });
                            });
                        }],
                    templateUrl: '../templates/dialogs/profile.html',
                    parent: angular.element(document.body),
                    clickOutsideToClose: true,
                    locals: {
                        positionDetail: positionDetail
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
