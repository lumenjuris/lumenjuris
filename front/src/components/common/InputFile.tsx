import { useDropzone } from "react-dropzone";
import { twMerge } from "tailwind-merge";
import { Upload } from "lucide-react";

interface InputFileProps {
  onDrop: (acceptedFiles: File[]) => void;
  fieldTitle?: string;
  fieldDescription?: string;
  supportedFileType?: string;
  fieldClassName?: string;
  iconClassName?: string;
  fieldTitleClassName?: string;
  fieldDescriptionClassName?: string;
  fileTypeClassName?: string;
  disabled?: boolean;
  accepted: Record<string, string[]>;
  multiple?: boolean;
}

const InputFile = ({
  onDrop,
  fieldTitle = "Importez votre fichier",
  fieldDescription = "Cliquez ici ou glissez-déposez votre fichier",
  supportedFileType = "tous formats",
  fieldClassName,
  iconClassName,
  fieldTitleClassName,
  fieldDescriptionClassName,
  fileTypeClassName,
  disabled = false,
  accepted,
  multiple = false,
}: InputFileProps) => {


  // Props pour react-dropzone | Remplace les props de la balise <input/>
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    //accept: Object.keys(accepted).length > 0 ? accepted : undefined, Ajout de accepted && (si json vide cela reste true)
    accept: accepted && Object.keys(accepted).length ? accepted : undefined,
    disabled: disabled,
    multiple: multiple,
  });

  return (
    <div
      {...getRootProps()}
      className={twMerge(
        `border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer has-disabled:opacity-50 has-disabled:cursor-not-allowed ${fieldClassName}`,
      )}
    >
      <input {...getInputProps()} className="hidden" />
      <section>
        <div
          className={twMerge(
            `mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600 ${iconClassName}`,
          )}
        >
          <Upload className="w-8 h-8" />
        </div>
        <h3
          className={twMerge(
            `text-lg font-semibold text-gray-900 mb-2 ${fieldTitleClassName}`,
          )}
        >
          {fieldTitle}
        </h3>
        <p
          className={twMerge(`text-gray-500 mb-4 ${fieldDescriptionClassName}`)}
        >
          {fieldDescription}
        </p>
        <div>
          <span
            className={twMerge(
              `bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-400 ${fileTypeClassName}`,
            )}
          >
            {`📄 Format supporté : ${supportedFileType}`}
          </span>
        </div>
      </section>
    </div>
  );
};

export default InputFile;
