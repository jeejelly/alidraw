import Trans from "./Trans";

const BraveMeasureTextError = () => {
  return (
    <div data-testid="brave-measure-text-error">
      <p>
        <Trans
          i18nKey="errors.brave_measure_text_error.line1"
          bold={(el) => <span style={{ fontWeight: 600 }}>{el}</span>}
        />
      </p>
      <p>
        <Trans
          i18nKey="errors.brave_measure_text_error.line2"
          bold={(el) => <span style={{ fontWeight: 600 }}>{el}</span>}
        />
      </p>
      <p>
        <Trans
          i18nKey="errors.brave_measure_text_error.line3"
          link={(el) => el}
        />
      </p>
      <p>
        <Trans
          i18nKey="errors.brave_measure_text_error.line4"
          issueLink={(el) => el}
          discordLink={(el) => <>{el}.</>}
        />
      </p>
    </div>
  );
};

export default BraveMeasureTextError;
