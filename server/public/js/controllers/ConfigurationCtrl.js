angular.module('ConfigurationCtrl', []).controller('ConfigurationController', function ($scope, gettextCatalog, $ocLazyLoad, $injector, $rootScope, $mdDialog, $transitions) {
    $scope.off = gettextCatalog.getString("OFF");
    $scope.on = gettextCatalog.getString("ON");
    $ocLazyLoad.load('js/services/ConfigurationService.js').then(function () {
        var Configuration = $injector.get('Configuration');

        var saved = {};
        Configuration.read().then(function (response) {
            var data = response.data;
            $rootScope.kernel.loading = 100;
            $scope.config = data;
            saved = JSON.parse(JSON.stringify($scope.config));
        }).catch(function (response) {
            console.log(response);
        });

        $scope.submit = function () {
            Configuration.update($scope.config).then(function (response) {
                saved = {};
                $rootScope.kernel.alerts.push({
                    type: 3,
                    msg: gettextCatalog.getString('Configuration has been saved'),
                    priority: 4
                });
            }).catch(function (response) {
                console.log(response);
            });
        };

        $transitions.onExit({}, function (trans) {
            if (saved.server && !angular.equals(saved, $scope.config)) {
                saved = {};
                var confirm = $mdDialog.confirm()
                        .title(gettextCatalog.getString("Warning"))
                        .textContent(gettextCatalog.getString("Would you like to save the new configuration") + gettextCatalog.getString("?"))
                        .ok(gettextCatalog.getString("Yes"))
                        .cancel(gettextCatalog.getString("No"));

                $mdDialog.show(confirm).then(function () {
                    // Save
                    $scope.submit();
                }, function () {
                    // Cancel
                });
            }
        });
    });
});