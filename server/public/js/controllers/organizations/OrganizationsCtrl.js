angular.module('OrganizationsCtrl', []).controller('OrganizationsController', function($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/OrganizationService.js').then(function() {
        var Organization = $injector.get('Organization');
        var helper = {
            title: gettextCatalog.getString("No organization"),
            icon: "account_balance"
        };

        $scope.organizations = [], $scope.helper = [];

        $scope.edit = function (params) {
            $state.go("home.organizations.edit", params);
        };

        function getOrganizations(){
            $scope.helper = [];
            Organization.list().then(function(response){
                var data = response.data;
                if(data.length == 0 && $scope.helper.length == 0){
                    $scope.helper = helper;
                }
                $rootScope.kernel.loading = 100;
                $scope.organizations = data;
            }).catch(function(response) {
                console.error(response);
            });
        }
        getOrganizations();

        
        function deleteOrganization(id){
            Organization.delete({
                id : id
            }).then(function(response){
                getOrganizations();
                $rootScope.kernel.alerts.push({
                    type: 3,
                    msg: gettextCatalog.getString('The organization has been deleted'),
                    priority: 4
                });
            }).catch(function(response) {
                console.error(response);
            });
        }

        $scope.showConfirm = function(organization){
            var confirm = $mdDialog.confirm()
            .title(gettextCatalog.getString("Delete this organization"))
            .textContent(gettextCatalog.getString("Are you sure you want to delete the organization") + " " + organization.name + gettextCatalog.getString("?"))
            .ok(gettextCatalog.getString("OK"))
            .cancel(gettextCatalog.getString("Cancel"));

            $mdDialog.show(confirm).then(function() {
                // Delete
                deleteOrganization(organization._id)
            }, function() {
                // Cancel
            });
        }
    });
});
