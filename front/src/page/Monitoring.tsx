import MainHeader from "../components/MainHeader/MainHeader";

import { useAuth } from "../context/AuthContext";

import { Navigate } from "react-router-dom";
import { useEffect } from "react";

export const Monitoring = () => {
  const { userRole, userConnected } = useAuth();

  useEffect(() => {
    //1. Chercher le role de user et refuser accès if !=="ADMIN"
    //2. Après le controle
    //2.1 If ADMIN
    //chercher la data du monitrogin ressurce lllm
    //chercher la data sur number users
    //2.2 if !admin
    //navigate to dashboard
  });

  return !userConnected ? (
    <Navigate to="/inscription" />
  ) : userRole != "ADMIN" ? (
    <Navigate to="/dashboard" />
  ) : (
    <>
      <MainHeader />
      <div>Page de monitoring des ressources</div>
    </>
  );
};
