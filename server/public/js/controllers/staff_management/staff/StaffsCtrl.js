angular.module('StaffsCtrl', []).controller('StaffsController', function($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/StaffService.js').then(function() {
        var StaffAgent = $injector.get('Staff');
        var helper = {
            title: gettextCatalog.getString("No project"),
            icon: "class"
        };

        $scope.personnels = [], $scope.helper = [];

        $scope.edit = function (params) {
            $state.go("home.staffs.edit", params);
        };

        function getAgents(){
            $scope.helper = [];
            StaffAgent.list().then(function(response){
                var data = response.data;
                if(data.length == 0 && $scope.helper.length == 0){
                    $scope.helper = helper;
                }
                $rootScope.kernel.loading = 100;
                $scope.personnels = data;
                console.log(JSON.stringify($scope.personnels))
            }).catch(function(response) {
                console.log(response);
            });
        }
        getAgents();

        
        function deleteAgent(id){
            StaffAgent.delete({
                id : id
            }).then(function(response){
                getAgents();
                $rootScope.kernel.alerts.push({
                    type: 3,
                    msg: gettextCatalog.getString('The Agent has been deleted'),
                    priority: 4
                });
            }).catch(function(response) {
                console.log(response);
            });
        }

        $scope.showConfirm = function(agent){
            var confirm = $mdDialog.confirm()
            .title(gettextCatalog.getString("Delete this Agent"))
            .textContent(gettextCatalog.getString("Are you sure you want to delete the Agent") + " " + agent.name.use + gettextCatalog.getString("?"))
            .ok(gettextCatalog.getString("OK"))
            .cancel(gettextCatalog.getString("Cancel"));

            $mdDialog.show(confirm).then(function() {
                // Delete
                deleteAgent(agent._id)
            }, function() {
                // Cancel
            });
        }
    });
});
