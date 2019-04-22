angular.module('DisciplinesCtrl', []).controller('DisciplinesController', function($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/ProjectService.js').then(function() {
        var Project = $injector.get('Project');
        var helper = {
            title: gettextCatalog.getString("No project"),
            icon: "class"
        };

        $scope.projects = [], $scope.helper = [];

        $scope.edit = function (params) {
            $state.go("home.staffs.edit", params);
        };

        function getProjects(){
            $scope.helper = [];
            Project.list().then(function(response){
                var data = response.data;
                if(data.length == 0 && $scope.helper.length == 0){
                    $scope.helper = helper;
                }
                $rootScope.kernel.loading = 100;
                $scope.projects = data;
            }).catch(function(response) {
                console.log(response);
            });
        }
        getProjects();

        
        function deleteProject(id){
            Project.delete({
                id : id
            }).then(function(response){
                getProjects();
                $rootScope.kernel.alerts.push({
                    type: 3,
                    msg: gettextCatalog.getString('The project has been deleted'),
                    priority: 4
                });
            }).catch(function(response) {
                console.log(response);
            });
        }

        $scope.showConfirm = function(project){
            var confirm = $mdDialog.confirm()
            .title(gettextCatalog.getString("Delete this project"))
            .textContent(gettextCatalog.getString("Are you sure you want to delete the project") + " " + project.name + gettextCatalog.getString("?"))
            .ok(gettextCatalog.getString("OK"))
            .cancel(gettextCatalog.getString("Cancel"));

            $mdDialog.show(confirm).then(function() {
                // Delete
                deleteProject(project._id)
            }, function() {
                // Cancel
            });
        }
    });
});
