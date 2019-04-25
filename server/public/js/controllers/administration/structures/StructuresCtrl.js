angular.module('StructuresCtrl', []).controller('StructuresController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/StructureService.js').then(function () {
        var Structure = $injector.get('Structure');
        var helper = {
            title: gettextCatalog.getString("No structure"),
            icon: "account_balance"
        };

        $scope.organizations = [], $scope.helper = [];
        $scope.search = false;
        $scope.query = {
            limit: 50,
            page: 1,
            order: "id"
        };

        $scope.edit = function (params) {
            $state.go("home.organizations.edit", params);
        };

        function getStructures() {
            $scope.helper = [];
            Structure.list().then(function (response) {
                var data = response.data;
                if (data.length == 0 && $scope.helper.length == 0) {
                    $scope.helper = helper;
                }
                $rootScope.kernel.loading = 100;
                $scope.structures = data;
            }).catch(function (response) {
                console.error(response);
            });
        }
        getStructures();


        function deleteStructures(id) {
            Structure.delete({
                id: id
            }).then(function (response) {
                getStructures();
                $rootScope.kernel.alerts.push({
                    type: 3,
                    msg: gettextCatalog.getString('The organization has been deleted'),
                    priority: 4
                });
            }).catch(function (response) {
                console.error(response);
            });
        }

        $scope.showConfirm = function (organization) {
            var confirm = $mdDialog.confirm()
                    .title(gettextCatalog.getString("Delete this organization"))
                    .textContent(gettextCatalog.getString("Are you sure you want to delete the organization") + " " + organization.name + gettextCatalog.getString("?"))
                    .ok(gettextCatalog.getString("OK"))
                    .cancel(gettextCatalog.getString("Cancel"));

            $mdDialog.show(confirm).then(function () {
                // Delete
                deleteStructure(organization._id)
            }, function () {
                // Cancel
            });
        }
    });
});
