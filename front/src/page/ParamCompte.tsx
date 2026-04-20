import MainHeader from "../components/MainHeader/MainHeader";

import { useState, useEffect, useContext } from "react";
import { Navigate, useNavigate } from "react-router-dom";

type UserDataProfile = {
  email: string;
  nom: string;
  prenom?: string;
  role: "USER" | "ADMIN";
  isVerified: boolean;
};

export function ParamCompte() {
  const [serverError, setServerError] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState("");
  const navigate = useNavigate();

  const [userData, setUserData] = useState({} as UserDataProfile);
  const [userAvatar, setUserAvatar] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/user/get", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const dataResponse = await response.json();
        console.log("USER DATA :", dataResponse);
        if (!dataResponse.data.profile.isVerified) {
          navigate("/inscription");
        } else if (!dataResponse.ok) {
          setServerError(true);
          setServerErrorMessage(dataResponse.message);
        } else if (
          dataResponse.success &&
          dataResponse.data.profile.isVerified
        ) {
          setUserData(dataResponse.data.profile);
          setUserAvatar(dataResponse.data.provider.avatarUrl);
        }
      } catch (error) {
        console.error("🛑🛑🛑 ERREUR SERVEUR GET USER", error);
        setServerError(true);
        setServerErrorMessage(
          "Nous sommes désolé, un problème est survenu lors de la récupération des données...",
        );
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <MainHeader />
      <div>Parametre de compte</div>
    </>
  );
}
