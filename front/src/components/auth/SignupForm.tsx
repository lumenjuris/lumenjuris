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
import { EyeOffIcon } from "lucide-react";

import { useState } from "react";

const SignupForm = () => {
  const [lastnameError, setLastnameError] = useState("");
  const [firstnameError, setFirstnameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangeLastname = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event);
  };

  const handleChangeFirstname = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    console.log(event);
  };

  const handleChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event);
  };

  const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event);
  };

  const handleChangeConfirmPassword = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    console.log(event);
  };

  const handleCheckNewsletter = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.checked;
    console.log(value);
  };

  return (
    <div className="w-[420px] border border-border p-4 rounded-xl flex flex-col gap-4 bg-background">
      <section>
        <h2 className="font-semibold text-[18px]">
          Créez un compte pour accéder à nos outils
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
                <InputGroupAddon align="inline-end">
                  <EyeOffIcon />
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
                <InputGroupAddon align="inline-end">
                  <EyeOffIcon />
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
                placeholder="Ex : 924242424"
                required
                onChange={handleChangeFirstname}
              />
              <FieldDescription>
                Saisissez le numéro Siren de votre société
              </FieldDescription>
            </Field>
          </div>
          <div className="grid gap-2">
            <FieldGroup className="mx-auto w-72">
              <Field orientation="horizontal">
                <Checkbox
                  id="terms-checkbox-desc"
                  name="terms-checkbox-desc"
                  defaultChecked={false}
                />
                <FieldContent>
                  <FieldLabel htmlFor="terms-checkbox-desc">
                    Valider les{" "}
                    <a
                      href="https://www.lumenjuris.com/conditions-generales-dutilisation/"
                      className="hover:cursor-pointer"
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
            <Button className="text-background">S'inscrire</Button>
            <Button variant="ghost" className="border border-lumenjuris">
              Se connecter avec Google
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SignupForm;
