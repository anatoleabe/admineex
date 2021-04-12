angular.module('TasksCtrl', ['dndLists']).controller('TasksController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/OrganizationService.js').then(function () {
        $s = $scope;
        $scope.models = {
            selected: null,
            lists: {
                "A": [],
                "B": []
            },
            tasks: []
        };

        // Generate initial model
        for (var i = 1; i <= 3; ++i) {
            $scope.models.lists.A.push({
                label: "Item A" + i
            });
            $scope.models.lists.B.push({
                label: "Item B" + i
            });
            $scope.models.tasks.push({
                label: "Tache" + i
            })
        }

        $scope.addToList = function (list) {
            var
                    i = {
                        label: "Item " + (list.length + 1)
                    };
            list.push(i);

        }

        $scope.addToTasks = function (task) {
            var
                    i = {
                        label: "Tache o " + (task.length + 1)
                    };
            task.push(i);

        }


        $scope.cloneItem = function (list, index) {
            var
                    //o = { label : list[index].label+"-1"};
                    o = angular.copy(list[index]);

            o.label = o.label + "-1";
            list.splice(index + 1, 0, o);
            //  $scope.$apply();
        }
        $scope.removeFromList = function (list, index) {
            list.splice(index, 1);
        }
        $scope.removeFromTasks = function (task, index) {
            task.splice(index, 1);
        }

        $scope.list = $scope.models.lists.A;
        $scope.taches = $scope.models.tasks;

        // Model to JSON for demo purpose
        $scope.$watch('models', function (model) {
            $scope.modelAsJson = angular.toJson(model, true);
        }, true);

        $s.models.selected = $s.models.lists["A"][1];
        console.log($s.models)
    });
});
