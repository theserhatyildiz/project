import { useContext, useState, useEffect } from "react";
import Footer from "../Footer";
import { UserContext } from "../../context/UserContext";
import ClipLoader from "react-spinners/ClipLoader";
import { useLocation } from "react-router-dom"; 
import { getMacroResult } from "../../utils/macroCalculators";

export default function MacroCoachForm() {
  
  const { loggedUser } = useContext(UserContext);
  const [csrfToken, setCsrfToken] = useState("");
  const [stepError, setStepError] = useState("");
  const [weightInKg, setWeightInKg] = useState(0);

    // ✅ 2. Read the "edit" query parameter from the URL
  const location = useLocation(); // <-- ADDED
  const queryParams = new URLSearchParams(location.search); // <-- ADDED
  const isEdit = queryParams.get("edit") === "true"; // <-- ADDED
  const [step, setStep] = useState(isEdit ? 2 : 1);

  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    weight: '',
    height: '',
    heightFeet: '',
    heightInches: '',
    unit: 'metric',
    bodyFatPercentage: '',
    lifeStyleFactor: '',
    exerciseFactor: '',
    goal: '',
    goalSpeed: '',
    carbIntake: '',
    proteinIntake: '',
    fatIntake: '',
    weightChange: '',
    current: '',
    carbPreference: '',
    proteinPreference: '',
    bodyFatRange: '',
    acceptedTerms: false
  });

    const femaleBodyFatRanges = [
      { min: 3, max: 13, range: "3-13", label: "10%" },
      { min: 14, max: 17, range: "14-17", label: "15%" },
      { min: 18, max: 23, range: "18-23", label: "18%" },
      { min: 24, max: 28, range: "24-28", label: "25%" },
      { min: 29, max: 34, range: "29-34", label: "30%" },
      { min: 35, max: 37, range: "35-37", label: "35%" },
      { min: 38, max: 41, range: "38-41", label: "40%" },
      { min: 42, max: 45, range: "42-45", label: "45%" },
      { min: 46, max: 50, range: "46-50", label: "50%" },
    ];

    const maleBodyFatRanges = [
      { min: 3, max: 4, range: "3-4", label: "3%" },
      { min: 5, max: 7, range: "5-7", label: "6%" },
      { min: 8, max: 12, range: "8-12", label: "10%" },
      { min: 13, max: 17, range: "13-17", label: "15%" },
      { min: 18, max: 23, range: "18-23", label: "20%" },
      { min: 24, max: 29, range: "24-29", label: "25%" },
      { min: 30, max: 34, range: "30-34", label: "32%" },
      { min: 35, max: 39, range: "35-39", label: "38%" },
      { min: 40, max: 50, range: "40-50", label: "45%" },
    ];

  const [bodyFatValue, setBodyFatValue] = useState(18);

  // decide which array to use
  const activeBodyFatRanges =
    formData.gender === "female" ? femaleBodyFatRanges : maleBodyFatRanges;

  // find the matched range in the chosen array
  const matchedRange = activeBodyFatRanges.find(
    (r) => bodyFatValue >= r.min && bodyFatValue <= r.max
  );


  useEffect(() => {
    async function fetchCsrfToken() {
      try {
        const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/csrf-token", {
          credentials: 'include',
        });
        const { csrfToken } = await response.json();
        if (csrfToken) {
          setCsrfToken(csrfToken);
          document.cookie = `XSRF-TOKEN=${csrfToken}; Secure; SameSite=Strict; path=/`;
        }
      } catch (error) {
        console.error('Error fetching CSRF token:', error);
      }
    }

    fetchCsrfToken();
  }, []);

// ✅ 3. Only redirect if the user has submitted AND did NOT come from "edit"
  useEffect(() => {
    async function checkSubmissionStatus() {
      try {
        const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/user/${loggedUser.userid}`, {
          headers: {
            Authorization: `Bearer ${loggedUser.token}`
          },
          credentials: 'include'
        });

        const data = await res.json();

        // ✅ Skip redirect if user came from "Change Goals" button (edit mode)
        if (data?.hasSubmittedCoachForm && !isEdit) { // <-- MODIFIED THIS LINE
          window.location.href = "/macrocoach";
        }
      } catch (err) {
        console.error("Error checking form submission status", err);
      }
    }

    if (loggedUser?.userid) {
      checkSubmissionStatus();
    }
  }, [loggedUser, isEdit]); // <-- ADDED isEdit as dependency

  useEffect(() => {
    let converted = parseFloat(formData.weight);
    if (formData.unit === 'imperial' && !isNaN(converted)) {
      converted = converted / 2.20462;
    }
    setWeightInKg(!isNaN(converted) ? converted : 0);
  }, [formData.weight, formData.unit]);

  useEffect(() => {
    if (formData.current === "no-change") {
      setFormData(prev => ({ ...prev, weightChange: "0" }));
    }
  }, [formData.current]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const validateStep = () => {
    if (step === 2) {
      const { age, gender, weight, unit, height, heightFeet, heightInches } = formData;

      const heightValid = unit === 'metric'
        ? !!height
        : !!heightFeet && !!heightInches;

      if (!age || !gender || !weight || !unit || !heightValid) {
        setStepError("Doldurulmamış alanlar var.");
        return false;
      }
    }

    if (step === 3 && !formData.bodyFatRange) {
  setStepError("Lütfen kaydırıcıyı hareket ettirerek vücut yağ oranınızı seçin.");
  return false;
}

    if (step === 4) {
      const { exerciseFactor, lifeStyleFactor } = formData;
      if (!exerciseFactor || !lifeStyleFactor) {
        setStepError("Doldurulmamış alanlar var.");
        return false;
      }
    }

    if (step === 5) {
      const { goal, goalSpeed } = formData;
      if (!goal || !goalSpeed) {
        setStepError("Doldurulmamış alanlar var.");
        return false;
      }
    }

    if (step === 6) {
      const { carbIntake, proteinIntake, fatIntake, weightChange, acceptedTerms } = formData;

      const enteredCarbs = !!carbIntake;
      const enteredProtein = !!proteinIntake;
      const enteredFat = !!fatIntake;

      const enteredAnyMacro = enteredCarbs || enteredProtein || enteredFat;
      const enteredAllMacros = enteredCarbs && enteredProtein && enteredFat;

      if (enteredAnyMacro && !enteredAllMacros) {
        setStepError("* Tüm makrolar eksiksiz girilmeli.");
        return false;
      }

      if (weightChange && !enteredAnyMacro) {
        setStepError("* Makrolar girilmeli.");
        return false;
      }

      if (enteredAnyMacro && !weightChange) {
        setStepError("* Kilo değişimi girilmeli.");
        return false;
      }

      if (weightChange && parseFloat(weightChange) >= 5.0) {
        setStepError("Kilo değişimi 5.0 kg'dan az olmalıdır.");
        return false;
      }

      if (!acceptedTerms) {
        setStepError("* Kabul etmelisiniz.");
        return false;
      }
    }

    setStepError("");
    return true;
  };

  const getGoalSpeedOptions = () => {
  if (!weightInKg) return [];

  const goal = formData.goal;

  const isMuscleGain = goal === "weight-gain";
  const isReverseDiet = goal === "reverse-diet";
  const isFatLoss = goal === "fat-loss";

  // ⚖️ Maintenance case
  if (goal === "maintenance") {
    return [{ value: "no-change", label: "Sıfır: 0kg/haftada" }];
  }

  // 💪 Weight Gain Options
  if (isMuscleGain) {
    return [
      { value: "slow", label: `Yavaş: ${(weightInKg * 0.000).toFixed(1)} - ${(weightInKg * 0.0025).toFixed(1)} kg/haftada (Önerilen)` },
      { value: "medium", label: `Orta: ${(weightInKg * 0.0025).toFixed(1)} - ${(weightInKg * 0.005).toFixed(1)} kg/haftada` },
      { value: "fast", label: `Hızlı: ${(weightInKg * 0.005).toFixed(1)} - ${(weightInKg * 0.008).toFixed(1)} kg/haftada` },
    ];
  }

  // 🔄 Reverse Diet Options
  if (isReverseDiet) {
    return [
      { value: "slow", label: `Yavaş: ${(weightInKg * 0.000).toFixed(1)} - ${(weightInKg * 0.0025).toFixed(1)} kg/haftada (Önerilen)` },
      { value: "medium", label: `Orta: ${(weightInKg * 0.0025).toFixed(1)} - ${(weightInKg * 0.005).toFixed(1)} kg/haftada` },
      { value: "fast", label: `Hızlı: ${(weightInKg * 0.005).toFixed(1)} - ${(weightInKg * 0.008).toFixed(1)} kg/haftada` },
    ];
  }

  // 🔥 Fat Loss Options
  if (isFatLoss) {
    return [
      { value: "slow", label: `Yavaş: ${(weightInKg * 0.0025).toFixed(1)} - ${(weightInKg * 0.005).toFixed(1)} kg/haftada` },
      { value: "medium", label: `Orta: ${(weightInKg * 0.005).toFixed(1)} - ${(weightInKg * 0.01).toFixed(1)} kg/haftada (Önerilen)` },
      { value: "fast", label: `Hızlı: ${(weightInKg * 0.01).toFixed(1)} - ${(weightInKg * 0.015).toFixed(1)} kg/haftada` },
    ];
  }

  // Default fallback
  return [];
};

  const nextStep = () => {
    if (!validateStep()) return;
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
  // 🧭 Special behavior when editing and on step 2
  if (isEdit && step === 2) {
    window.location.href = "/macrocoach"; // Redirect back to macrocoach page
    return;
  }

  setStep((prev) => prev - 1);
  setStepError("");
};

const handleSubmit = async (e) => {
  e.preventDefault();

  if (!validateStep()) return;

  const payload = { ...formData, userId: loggedUser.userid };

  // Convert units if needed
  if (payload.unit === 'imperial') {
    const feet = parseFloat(payload.heightFeet || 0);
    const inches = parseFloat(payload.heightInches || 0);
    payload.height = (feet * 30.48 + inches * 2.54).toFixed(1);
    payload.weight = (parseFloat(payload.weight) / 2.20462).toFixed(1);
  }

  delete payload.heightFeet;
  delete payload.heightInches;

  if (!payload.current) delete payload.current;
  if (!payload.carbIntake) delete payload.carbIntake;
  if (!payload.proteinIntake) delete payload.proteinIntake;
  if (!payload.fatIntake) delete payload.fatIntake;
  if (!payload.weightChange) delete payload.weightChange;

  try {
    const res = await fetch('https://galwinapp1-c1d71c579009.herokuapp.com/macrocoachform/submit', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${loggedUser.token}`,
        "CSRF-Token": csrfToken
      },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      // ✅ If in "edit" mode, also calculate and POST macros
      if (isEdit) {
        const calculatedMacros = getMacroResult(payload);

        await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/${loggedUser.userid}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${loggedUser.token}`,
            "CSRF-Token": csrfToken
          },
          credentials: "include",
          body: JSON.stringify({
            ...calculatedMacros,
            reason: "initial", // or "initial"
            goal: payload.goal,
            goalSpeed: payload.goalSpeed,
          }),
        });

        console.log("✅ Updated macros sent after form edit");
      }

      window.location.href = "/macrocoach";
    } else {
      console.log('❌ Hata oluştu: ' + data.error);
    }
  } catch (err) {
    console.error("❌ Submit error:", err);
  }
};
  

  return (
    <>
      <section className="macro-container macro-coach-form">
        <div className='macro-coach-form-wrapper'>
          <h1>Makro Koçu</h1>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="macro-coach-form-label-intro-card">
                <h2>Makro Koçu Aktif Değil!</h2>
                <p>Hedeflerine ulaşmana yardımcı olacak yapay zeka destekli kişisel makro koçunla hemen çalışmaya başla!</p>
                <button type="button" className="btn-primary" onClick={nextStep}>Şimdi Başla</button>
              </div>
            )}

            {step === 2 && (
              <>
                {!isEdit && (
                  <div className='macro-coach-form-discription'>
                    <p>
                      <strong>Makro Koçu</strong>, kullanıcıların hedeflerine ulaşmalarına yardımcı olmak adına <strong>birebire</strong> yakın destek sunan devrim niteliğinde bir özelliktir.
                    </p>

                    <p>
                      Yalnızca ayda <strong>99.99TL</strong> karşılığında seni başarıya götürecek makro koçuna sahip ol.
                    </p>

                    <p>
                      Başlamak için aşağıdaki bilgileri doldurman yeterli.
                    </p>
                  </div>
                )}
                <h2>Kişisel Bilgiler</h2>
                <input type="number" name="age" placeholder="Yaş" className="input" onChange={handleChange} value={formData.age} />

                <div className='macro-coach-gender-unit'>
                  <label className='macro-coach-form-label'>
                    <input type="radio" name="gender" value="male" onChange={handleChange} checked={formData.gender === 'male'} /> Erkek
                  </label>
                  <label className='macro-coach-form-label'>
                    <input type="radio" name="gender" value="female" onChange={handleChange} checked={formData.gender === 'female'} /> Kadın
                  </label>
                </div>

                <div className='macro-coach-gender-unit'>
                  <label className='macro-coach-form-label'>
                    <input type="radio" name="unit" value="imperial" onChange={handleChange} checked={formData.unit === 'imperial'} /> Imperial
                  </label>
                  <label className='macro-coach-form-label'>
                    <input type="radio" name="unit" value="metric" onChange={handleChange} checked={formData.unit === 'metric'} /> Metrik
                  </label>
                </div>

                <input type="number" name="weight" placeholder={formData.unit === 'metric' ? 'Kilo (kg)' : 'Kilo (lbs)'} className="input" onChange={handleChange} value={formData.weight} />

                {formData.unit === 'metric' ? (
                  <input type="number" name="height" placeholder="Boy (cm)" className="input" onChange={handleChange} value={formData.height} />
                ) : (
                  <div className="macro-coach-height-imperial">
                    <input type="number" name="heightFeet" placeholder="Feet" className="input" onChange={handleChange} value={formData.heightFeet} />
                    <input type="number" name="heightInches" placeholder="Inches" className="input" onChange={handleChange} value={formData.heightInches} />
                  </div>
                )}
              </>
            )}
            {step === 3 && (
  <>
    <h2>Vücut Yağ Seviyesi</h2>

    <div className="fat-slider-container">
      <div className="fat-slider-image">
        <img
          src={`/images/${formData.gender === 'male' ? 'male' : 'female'}/${matchedRange?.range}.png`}
          alt={`Body fat ${matchedRange?.label}`}
        />
        <p className="fat-slider-label">{bodyFatValue}%</p>
      </div>

      <input
        type="range"
        min="3"
        max="50"
        step="1"
        value={bodyFatValue}
        onChange={(e) => {
          const val = parseInt(e.target.value);
          setBodyFatValue(val);
          setFormData((prev) => ({
            ...prev,
            bodyFatRange: `${val}%`, // Save exact % value
            bodyFatPercentage: val   
          }));
        }}
        className="fat-slider"
        style={{
          background: `linear-gradient(to right, #cc1f43 ${(bodyFatValue - 3) / (50 - 3) * 100}%, #e5e5e5 ${(bodyFatValue - 3) / (50 - 3) * 100}%)`,
        }}
      />

      <p className="fat-slider-description">
        Kaydırıcıyı hareket ettirerek en uygun vücut yağ oranını seçin. %100 doğru olması gerekmez. Yakın olması yeterlidir.
      </p>
    </div>
  </>
)}

            {step === 4 && (
              <>
                <h2>Aktivite Seviyesi</h2>
                <select name="lifeStyleFactor" onChange={handleChange} value={formData.lifeStyleFactor} className="input">
                  <option value="">Aktivite Seviyesi Seç</option>
                  <option value="sedantery">Hareketsiz</option>
                  <option value="light">Az miktarda ayakta durma, yürüme</option>
                  <option value="moderate">Genelde ayakta ya da hareketli</option>
                  <option value="high">Tüm günü ayakta geçirme</option>
                  <option value="very high">Ağır bedensel güç gerektiren bir iş</option>
                </select>

                <select name="exerciseFactor" onChange={handleChange} value={formData.exerciseFactor} className="input">
                  <option value="">Egzersiz Seviyesi Seç</option>
                  <option value="noexercise">Sıfır egzersiz</option>
                  <option value="light">Haftada 1-2 gün</option>
                  <option value="moderate">Haftada 3-4 gün</option>
                  <option value="heavy">Haftada 5-6 gün</option>
                  <option value="very-heavy">Her gün egzersiz</option>
                </select>
              </>
            )}

            {step === 5 && (
              <>
                <h2>Hedefler</h2>
                <select name="goal" onChange={handleChange} value={formData.goal} className="input">
                  <option value="">Hedef Seç</option>
                  <option value="fat-loss">Kilo verme</option>
                  <option value="weight-gain">Kilo alma</option>
                  <option value="reverse-diet">Reverse diyet</option>
                </select>
                <select name="goalSpeed" onChange={handleChange} value={formData.goalSpeed} className="input">
                  <option value="">Tercih Edilen Hız</option>
                  {getGoalSpeedOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </>
            )}

            {step === 6 && (
              <>
                <h2>Tükettiğiniz Makrolar</h2>
                <input type="number" name="proteinIntake" placeholder="Protein (g)" className="input" onChange={handleChange} value={formData.proteinIntake} />
                <input type="number" name="carbIntake" placeholder="Karbonhidrat (g)" className="input" onChange={handleChange} value={formData.carbIntake} />
                <input type="number" name="fatIntake" placeholder="Yağ (g)" className="input" onChange={handleChange} value={formData.fatIntake} />

                <h2>Kilo Değişimi</h2>
                <select name="current" onChange={handleChange} value={formData.current} className="input">
                  <option value="" disabled>Kilo Değişimi</option>
                  <option value="fat-loss">Azalış</option>
                  <option value="weight-gain">Artış</option>
                  <option value="no-change">Değişiklik yok</option>
                </select>

                <input type="number" name="weightChange" placeholder="Kilo değişimi (kg)" className="input" onChange={handleChange} value={formData.weightChange} disabled={formData.current === "no-change"} />

                <label className='macro-coach-form-label'>
                  <input type="checkbox" name="acceptedTerms" onChange={handleChange} checked={formData.acceptedTerms} />
                  Hizmet Şartları ve Gizlilik Politikasını kabul ediyorum
                </label>
              </>
            )}

            {step !== 1 && (
              <div>
                {step > 1 && <button type="button" onClick={prevStep} className="btn-macro-coach-form">Geri</button>}
                {step < 6 && <button type="button" onClick={nextStep} className="btn-macro-coach-form">İleri</button>}
                {step === 6 && <button type="submit" className="btn-primary">Şimdi Başla</button>}
                {stepError && <p style={{ color: 'red', marginTop: '8px' }}>{stepError}</p>}
              </div>
            )}
          </form>
        </div>
      </section>

      {step === 1 && <Footer />}
    </>
  );
}