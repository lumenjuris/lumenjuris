// UI //
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
} from "../ui/Field";
import { Separator } from "../ui/Separator";
import { Checkbox } from "../ui/Checkbox";
import { Label } from "../ui/Label";
import { EyeOffIcon, EyeIcon } from "lucide-react";

import { useState } from "react";

//  const [lastName, setLastName] = useState("");
//   const [firstName, setFirstName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [siren, setSiren] = useState("");
//   const [acceptCgu, setAcceptCgu] = useState(false);

interface SignupFormProps {
  lastName: string;
  setLastName: React.Dispatch<React.SetStateAction<string>>;
  firstName: string;
  setFirstName: React.Dispatch<React.SetStateAction<string>>;
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  siren: string;
  setSiren: React.Dispatch<React.SetStateAction<string>>;
  acceptCgu: boolean;
  setAcceptCgu: React.Dispatch<React.SetStateAction<boolean>>;
}

const SignupForm = ({
  lastName,
  setLastName,
  firstName,
  setFirstName,
  email,
  setEmail,
  password,
  setPassword,
  siren,
  setSiren,
  acceptCgu,
  setAcceptCgu,
}: SignupFormProps) => {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [lastnameError, setLastnameError] = useState("");
  const [firstnameError, setFirstnameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangeLastname = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setLastName(value);
  };

  const handleChangeFirstname = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    setFirstName(value);
  };

  const handleChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEmail(value);
  };

  const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPassword(value);
    if (value.length < 8 && value.length > 0) {
      setPasswordError("Le mot de passe est trop court");
    } else {
      setPasswordError("");
    }
  };

  const handleChangeConfirmPassword = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    console.log(event);
  };

  const handleCheckCgu = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    console.log(value);
  };

  return (
    <div className="w-[420px] border border-border p-4 rounded-xl flex flex-col gap-4 bg-background">
      <section>
        <h2 className="font-semibold text-[18px]">
          Créez un compte et accéder à nos outils
        </h2>
        <p className="text-black/50">Complétez les champs suivants</p>
      </section>
      <form>
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Field>
              <FieldLabel htmlFor="lastname">Nom</FieldLabel>
              <Input
                id="lastname"
                type="text"
                placeholder="Dupond"
                required
                onChange={handleChangeLastname}
              />
            </Field>
          </div>
          <div className="grid gap-2">
            <Field>
              <FieldLabel htmlFor="firstname">Prénom</FieldLabel>
              <Input
                id="firstname"
                type="text"
                placeholder="Jenny"
                required
                onChange={handleChangeFirstname}
              />
            </Field>
          </div>
          <div className="grid gap-2">
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="mail@example.com"
                required
                onChange={handleChangeEmail}
              />
            </Field>
          </div>
          <div className="grid gap-2">
            <Field className="max-w-sm">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Choisissez un mot de passe"
                  required
                  onChange={handleChangePassword}
                />
                <InputGroupAddon
                  align="inline-end"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:cursor-pointer"
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </div>
          <div className="grid gap-2">
            <Field className="max-w-sm">
              <FieldLabel htmlFor="confirmpassword">
                Confirm password
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="confirmpassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirmez votre mot de passe"
                  required
                  onChange={handleChangeConfirmPassword}
                />
                <InputGroupAddon
                  align="inline-end"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="hover:cursor-pointer"
                >
                  {showConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </div>
          <div className="grid gap-2">
            <Field>
              <FieldLabel htmlFor="siren">Siren</FieldLabel>
              <Input
                id="siren"
                type="text"
                placeholder="924242424"
                required
                onChange={handleChangeFirstname}
              />
              <FieldDescription>
                Saisissez le numéro Siren de votre société
              </FieldDescription>
            </Field>
          </div>
          <div className="grid gap-2">
            <FieldGroup className="w-72">
              <Field orientation="horizontal">
                <Checkbox
                  id="terms-checkbox-desc"
                  name="terms-checkbox-desc"
                  defaultChecked={false}
                  required
                  onCheckedChange={(checked) => {
                    handleCheckCgu({
                      target: { checked },
                    } as React.ChangeEvent<HTMLInputElement>);
                  }}
                  className="border-ring"
                />
                <FieldContent>
                  <FieldLabel htmlFor="terms-checkbox-desc">
                    Valider nos{" "}
                    <a
                      href="https://www.lumenjuris.com/conditions-generales-dutilisation/"
                      className="hover:cursor-pointer underline"
                    >
                      CGU
                    </a>
                  </FieldLabel>
                </FieldContent>
              </Field>
            </FieldGroup>
          </div>
          <div className="w-full h-px bg-border"></div>
          <div className="grid gap-2">
            <Button
              className="text-background"
              disabled={submitLoading && true}
            >
              S'inscrire
            </Button>
            <Button
              variant="ghost"
              className="border border-lumenjuris text-lumenjuris"
            >
              Se connecter avec Google
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SignupForm;
