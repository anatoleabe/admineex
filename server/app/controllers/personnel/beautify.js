const dictionary = require("../../utils/dictionary");
const log = require("../../utils/log");

// Controllers
const controllersPositions = require("../positions");
const controllersConfiguration = require("../configuration");
const controllersPersonnelIndex = require("./index");

exports.beautify = (options, personnels, callback) => {
    let language = options.language || "";
    language = language.toLowerCase();
    if (options.beautify && options.beautify === true) {
        //Address
        personnels = controllersConfiguration.beautifyAddress({language: language}, personnels);
        function LoopA(a) {
            if (a < personnels.length && personnels[a]) {
                controllersPositions.findPositionHelderBystaffId({req: options.req}, personnels[a]._id, async function (err, affectation) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {

                        let status = (personnels[a].status) ? personnels[a].status : "";
                        let grade = (personnels[a].grade) ? personnels[a].grade : "";
                        let rank = (personnels[a].rank) ? personnels[a].rank : "";
                        let category = (personnels[a].category) ? personnels[a].category : "";



                        let highestLevelEducation = (personnels[a].qualifications) ? personnels[a].qualifications.highestLevelEducation : "";
                        let natureActe = (personnels[a].history) ? personnels[a].history.nature : "";
                        let corps = personnels[a].corps;

                        personnels[a].age = await controllersPersonnelIndex._calculateAge(new Date(personnels[a].birthDate));

                        let retirementLimit = 60;
                        //Decree N°2020/802 of 30 December 2020 of the President of the Republic harmonising the retirement age of civil servants.
                        if (personnels[a].status === "1") {//Civil servant
                            if (personnels[a].category && personnels[a].category != null && personnels[a].category !== "") {
                                if ((personnels[a].category === "5" || personnels[a].category === "6")) { //for category 'C' and 'D' staff, retirement at 55
                                    retirementLimit = 55;
                                } else {//Harmonised at sixty (60) years for category 'A' and 'B' staff
                                    retirementLimit = 60;
                                }
                            } else {//Harmonised at sixty (60) years in case of other categories
                                retirementLimit = 60;
                            }
                        } else {// Contractual
                            if (personnels[a].category && personnels[a].category != null && personnels[a].category !== "") {
                                if (parseInt(personnels[a].category, 10) >= 1 && parseInt(personnels[a].category, 10) <= 7) { //Personnel non fonctionnaire CAT 1 à CAT 7 at 55 ans
                                    retirementLimit = 55;
                                } else {//Personnel non fonctionnaire CAT 8 à CAT 12 à 60 ans
                                    retirementLimit = 60;
                                }
                            } else {//other in case
                                retirementLimit = 60;
                            }
                        }
                        personnels[a].retirementDate = new Date(personnels[a].birthDate).setFullYear(new Date(personnels[a].birthDate).getFullYear() + retirementLimit);



                        personnels[a].status = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status.json', status, language);

                        if (status !== "") {
                            personnels[a].grade = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), language);
                            personnels[a].category = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/categories.json', category, language);
                            let thisgrade = dictionary.getJSONById('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), language);
                            if (thisgrade) {
                                corps = ((personnels[a].corps) ? personnels[a].corps : thisgrade.corps);
                            }

                            if (corps && corps !== "") {
                                personnels[a].corps = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/corps.json', corps + "", language);
                            }
                        }

                        if (rank){
                            personnels[a].rank = dictionary.getValueFromJSON('../../resources/dictionary/personnel/ranks.json', rank, language);
                        }

                        if (highestLevelEducation !== "") {
                            personnels[a].qualifications.highestLevelEducation = dictionary.getValueFromJSON('../../resources/dictionary/personnel/educationLevels.json', parseInt(highestLevelEducation, 10), language);
                        }

                        if (natureActe !== "") {
                            personnels[a].history.nature = dictionary.getValueFromJSON('../../resources/dictionary/acts/natures.json', natureActe, language);
                        }


                        let situations = personnels[a].situations;
                        if (situations && situations.length > 0) {
                            situations.sort(function (a, b) {
                                return new Date(b.lastModified) - new Date(a.lastModified);
                            });
                            for (let i in situations) {
                                situations[i].value = dictionary.getValueFromJSON('../../resources/dictionary/personnel/situations.json', situations[i].situation, language);
                            }
                            personnels[a].situations = situations;
                        }

                        let sanctions = personnels[a].sanctions;
                        if (sanctions && sanctions.length > 0) {
                            sanctions.sort(function (a, b) {
                                if (a && b && a !== "null" && b !== "null") {
                                    return new Date(b.date) - new Date(a.date);
                                } else {
                                    return 1;
                                }

                            });
                            for (let i in sanctions) {
                                if (sanctions[i]) {
                                    sanctions[i].value = dictionary.getValueFromJSON('../../resources/dictionary/personnel/sanctions.json', sanctions[i].sanction, language);
                                }
                            }
                            personnels[a].sanctions = sanctions;
                        }

                        personnels[a].affectedTo = affectation;
                        if (personnels[a].affectedTo && personnels[a].affectedTo.rank) {
                            personnels[a].affectedTo.rank = dictionary.getValueFromJSON('../../resources/dictionary/personnel/ranks.json', personnels[a].affectedTo.rank, language);
                        }
                        personnels[a].skillsCorresponding = 0;
                        personnels[a].profilesCorresponding = 0;

                        //ASKED BY DGTCFM ONLY FOR TRESOR STAFF
                        //TODO: Ajouter le corps du mestier dans chaque poste. Example : Tresor
                        //Ainsi, il nous suffira de comparer le corps réel du personnel et le corps du metier (lié au poste)
                        if (corps === "2") {//Corps des Régies Financières Trésor
                            personnels[a].skillsCorresponding = 40;
                            personnels[a].profilesCorresponding = 40;
                        }

                        let userProfiles = personnels[a].profiles;
                        let userSkills = personnels[a].skills;

                        let requiredProfiles = [];
                        let requiredSkills = [];

                        if (options.eligibleTo && options.position) {//Case we compute the eligibility, take it from the concerned position
                            requiredProfiles = options.position.requiredProfiles;
                            requiredSkills = options.position.requiredSkills;
                        } else {
                            if (personnels[a].affectedTo && personnels[a].affectedTo.position) {//Normal case. We just compute corresponding percentages
                                requiredProfiles = personnels[a].affectedTo.position.requiredProfiles;
                                requiredSkills = personnels[a].affectedTo.position.requiredSkills;
                            }
                        }

                        if (requiredProfiles && requiredProfiles.length > 0) {
                            let count = 0;
                            if (userProfiles && userProfiles.length > 0) {
                                for (let i in userProfiles) {
                                    if (requiredProfiles.includes(userProfiles[i])) {
                                        count = count + 1;
                                    }
                                }
                            }
                            personnels[a].profilesCorresponding += Number((100 * (count / requiredProfiles.length)).toFixed(1));
                            if (personnels[a].profilesCorresponding > 100) {
                                personnels[a].profilesCorresponding = 100;
                            }
                        }

                        if (requiredSkills && requiredSkills.length > 0) {
                            let count = 0;
                            if (userSkills && userSkills.length > 0) {
                                for (let i in userSkills) {
                                    if (requiredSkills.includes(userSkills[i])) {
                                        count = count + 1;
                                    }
                                }
                            }
                            personnels[a].skillsCorresponding += Number((100 * (count / requiredProfiles.length)).toFixed(1));
                            if (personnels[a].skillsCorresponding > 100) {
                                personnels[a].skillsCorresponding = 100;
                            }
                        }

                        personnels[a].corresponding = Number(((personnels[a].skillsCorresponding + personnels[a].profilesCorresponding) / 2).toFixed(1));



                        LoopA(a + 1);
                    }
                });
            } else {
                callback(null, personnels);
            }
        }

        LoopA(0);
    } else {
        callback(null, personnels);
    }
}


