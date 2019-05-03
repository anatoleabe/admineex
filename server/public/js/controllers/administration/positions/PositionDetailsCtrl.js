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


            $scope.add = function (id) {
                var p;
                $mdDialog.show({
                    controller: ['$scope', '$mdDialog', 'p', '$q', function ($scope, $mdDialog, p, $q) {
                            $scope.contact = p;
                            $scope.selectedProfiles = [];

                            $scope.profilesList = [
                                {
                                    'name': 'Broccoli',
                                    'type': 'Brassica'
                                },
                                {
                                    'name': 'Cabbage',
                                    'type': 'Brassica'
                                },
                                {
                                    'name': 'Carrot',
                                    'type': 'Umbelliferous'
                                },
                                {
                                    'name': 'Lettuce',
                                    'type': 'Composite'
                                },
                                {
                                    'name': 'Spinach',
                                    'type': 'Goosefoot'
                                }
                            ];

                            $scope.querySearchInProfiles = function (text) {
                                var deferred = $q.defer();
                                if (text) {
                                    var profile = $.grep($scope.profilesList, function (c, i) {
                                        return c.name.toLowerCase().includes(text.toLowerCase());
                                    });
                                    deferred.resolve(profile);
                                } else {
                                    deferred.resolve($scope.profilesList);
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
                                $mdDialog.hide();
                                console.log($scope.selectedProfiles);
                            };

                        }],
                    templateUrl: '../templates/dialogs/profile.html',
                    parent: angular.element(document.body),
                    clickOutsideToClose: true,
                    locals: {
                        p: p
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
