import { useState } from "react"



/*
Information que l'on doit récolter

-Proffession
-Première intention outil
*/

const FindIsNewUserFromStorage = (): boolean => {
  const newUserLocalStorage = localStorage.getItem("isNewUser")
  return newUserLocalStorage ? true : false
}





export const Sandbox = () => {
  const [displayForm, setDisplayForm] = useState<boolean>(FindIsNewUserFromStorage())
  const [pageFormReview, setPageFormReview] = useState<number>(0)

  const arrayPageForm = [PageFormProfil, PageFormOrganisation, PageFormActivity, PageFormBesoin]
  const CurrentPage = arrayPageForm[pageFormReview]

  const btnCss = "border-1-black gap-2 bg-white p-2 mr-2 mt-2 rounded hover:bg-white/15"

  const RemoveStorageNewUser = (): void => { localStorage.removeItem("isNewUser"); setDisplayForm(false) }
  const SetStorageTrue = (): void => { localStorage.setItem("isNewUser", "true"); setDisplayForm(true) }


  return (
    <div className="h-[100vh]">

      <button
        onClick={SetStorageTrue}
        className={btnCss}
      >
        Ajouter au storage
      </button>

      <button
        onClick={RemoveStorageNewUser}
        className={btnCss}
      >
        Retirer du storage
      </button>




      {displayForm && (
        <div className="flex flex-col justify-center items-center border-1-black bg-white w-max m-auto mt-[100px] p-4">
          <span>formulaire de nouveau User</span>
          <span>Le présent formulaire est une introduction à Lumen Juris, celui-ci permettra de configurer votre compte </span>

          <div>

            {CurrentPage && <CurrentPage />}

          </div>

          <FormBtnFooter
            setDisplayForm={setDisplayForm}
            setPageFormReview={setPageFormReview}
            btnCss={btnCss}
            pageFormReview={pageFormReview}
            pageFormLength={arrayPageForm.length}
          />

        </div>
      )
      }

    </div >
  )
}








//Gestion des boutons footer pour naviguer dans le formulaire
type FormBtnFooterProps = {
  setPageFormReview: React.Dispatch<React.SetStateAction<number>>,
  setDisplayForm: React.Dispatch<React.SetStateAction<boolean>>,
  btnCss: string,
  pageFormReview: number
  pageFormLength: number
}

const FormBtnFooter = ({
  setPageFormReview,
  setDisplayForm,
  btnCss,
  pageFormReview,
  pageFormLength }: FormBtnFooterProps): React.ReactElement => {
  return (
    <div>

      {pageFormReview > 0 && (
        <button
          className={btnCss}
          onClick={() => setPageFormReview((prev: number) => prev - 1)}
        >
          Retour
        </button>)}


      {pageFormLength !== pageFormReview && (
        <button
          className={btnCss}
          onClick={() => setPageFormReview((prev: number) => prev + 1)}
        >
          Suivant
        </button>
      )}


      <button
        className={btnCss}
        onClick={() => setDisplayForm(false)}
      >
        Annuler et reprendre plus tard
      </button>
    </div>
  )
}


const PageFormProfil = (): React.ReactElement => {

  return (
    <div>
      <label htmlFor=""></label>
      <input type="text" />
    </div>
  )
}

const PageFormOrganisation = (): React.ReactElement => {

  return (
    <div>
      <label htmlFor=""></label>
      <input type="text" />
    </div>
  )
}

const PageFormActivity = (): React.ReactElement => {

  return (
    <div>
      <label htmlFor=""></label>
      <input type="text" />
    </div>
  )
}

const PageFormBesoin = (): React.ReactElement => {

  return (
    <div>
      <label htmlFor=""></label>
      <input type="text" />
    </div>
  )
}