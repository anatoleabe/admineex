angular.module('TasksCtrl', ['dndLists']).controller('TasksController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/TaskService.js').then(function () {
        var Task = $injector.get('Task');
        $s = $scope;
        $scope.models = {
            selected: null,
            lists: {
                "A": [],
                "B": []
            },
            tasks: []
        };

        $scope.details = function (params) {
            $state.go("home.tasks.details", params);
        };

        $scope.edit = function (params) {
            $state.go("home.tasks.edit", params);
        };

        $scope.new = function () {
            $state.go("home.tasks.new");
        };

        $rootScope.kernel.loading = 100;


        function getMyTasks() {
            $scope.helper = [];
            Task.list().then(function (response) {
                var data = response.data;
                if (data.length == 0 && $scope.helper.length == 0) {
                    $scope.helper = "No task";
                }
                $rootScope.kernel.loading = 100;
                $scope.tasks = data;
            }).catch(function (response) {
                console.error(response);
            });
        }
        getMyTasks();





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

        $scope.people = [
            {name: 'Janet Perkins', img: 'img/100-0.jpeg', newMessage: true},
            {name: 'Mary Johnson', img: 'img/100-1.jpeg', newMessage: false},
            {name: 'Peter Carlsson', img: 'img/100-2.jpeg', newMessage: false}
        ];


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
