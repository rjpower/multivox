import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithStorage, freezeAtom } from "jotai/utils";
import { Scenario } from "../../types";

interface UserScenario extends Scenario {
  isCustom: true;
  dateCreated: number;
}

export const systemScenariosAtom = atom<Scenario[]>([]);
export const userScenariosAtom = freezeAtom(
  atomWithStorage<UserScenario[]>("userScenarios", [])
);

export const useSystemScenarios = () => {
  return useAtomValue(systemScenariosAtom);
};

export const useUserScenarios = () => {
  const [userScenarios, setUserScenarios] = useAtom(userScenariosAtom);

  const removeUserScenario = (id: string) => {
    const newUserScenarios = userScenarios.filter((s) => s.id !== id);
    setUserScenarios(newUserScenarios);
  };

  const updateUserScenario = (scenario: Scenario) => {
    let newUserScenarios;
    const existingScenario = userScenarios.find((s) => s.id === scenario.id);

    if (existingScenario) {
      newUserScenarios = userScenarios.map((s) =>
        s.id === scenario.id ? { ...s, ...scenario } : s
      );
    } else {
      const newScenario: UserScenario = {
        ...scenario,
        isCustom: true,
        dateCreated: Date.now(),
      };
      newUserScenarios = [...userScenarios, newScenario];
    }

    setUserScenarios(newUserScenarios);
  };

  return { userScenarios, removeUserScenario, updateUserScenario };
};
