angular.module('InstallationCtrl', []).controller('InstallationController', function ($window, $mdDialog, $scope, gettextCatalog, $ocLazyLoad, $injector, $rootScope, $state, $filter) {
    var alert;
    var firstTime = true;
    var labmanagerfullname = undefined;
    $scope.loading = true;

    $scope.config = {
    };

    $ocLazyLoad.load('js/services/InstallationService.js').then(function () {
        var Installation = $injector.get('Installation');
        $ocLazyLoad.load('js/services/ConfigurationService.js').then(function () {
            var Configuration = $injector.get('Configuration');
            $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
                var Dictionary = $injector.get('Dictionary');

                // Read config
                Installation.read().then(function (response) {
                    var data = response.data;
                    $scope.config = data;
                    $scope.loading = false;
                }).catch(function (response) {
                    $scope.loading = false;
                    console.log(response);
                });

                $scope.submitNext = function (step) {
                    switch (step) {
                        case 1:// First step
                            $scope.loading = true;
                            Installation.update($scope.config).then(function (response) {
                                $state.go('installation.second');
                                $scope.loading = false;
                            }).catch(function (response) {
                                $scope.loading = false;
                                console.log(response);
                            });
                            break;
                        case 2:// Second step
                            $scope.loading = true;
                            $scope.user.language = 'EN';
                            $scope.config.step = step;
                            Installation.admin($scope.user).then(function (response) {
                                $scope.loading = true;
                                // Save items in configuration file and delete WIZARD file, Start Texto if it is enable 
                                Installation.update($scope.config).then(function (response) {
                                    $state.go('signin');
                                    $scope.loading = false;
                                }).catch(function (response) {
                                    $scope.loading = false;
                                    console.log(response);
                                });
                                $scope.loading = false;
                            }).catch(function (response) {
                                $scope.loading = false;
                                console.log(response);
                            });
                            break;
                    };
                };
                
                $scope.goTo = function (station) {
                    $state.go(station);
                };
            });
        });
    });

    function showAlert(title, content) {
        alert = $mdDialog
            .alert()
            .title(title)
            .textContent(content)
            .ok(gettextCatalog.getString("OK"));
        $mdDialog
            .show(alert)
            .finally(function () {
            alert = undefined;
        });
    }
});