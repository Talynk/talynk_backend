const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const os = require("os");

/**
 * Helper function to format Hive API response into user-friendly format
 * @param {Object} output - Raw output from Hive API
 * @returns {Object} Formatted response
 */
const formatHiveResponse = (output) => {
  const classes = output.classes || [];

  // Create a clean, user-friendly summary
  const summary = {
    flagged: false,
    concerns: [],
    safe: true,
    overallAssessment: "Content appears safe",
    categories: {},
  };

  // Define content categories with their yes/no pairs
  const contentCategories = {
    nsfw: {
      title: "NSFW Content",
      pairs: {
        general_nsfw: {
          yes: "general_nsfw",
          no: "general_not_nsfw_not_suggestive",
          label: "General NSFW",
        },
        nudity: {
          yes: "yes_female_nudity",
          no: "no_female_nudity",
          label: "Female Nudity",
        },
        male_nudity: {
          yes: "yes_male_nudity",
          no: "no_male_nudity",
          label: "Male Nudity",
        },
        breast: {
          yes: "yes_breast",
          no: "no_breast",
          label: "Breast Exposure",
        },
        genitals: {
          yes: "yes_genitals",
          no: "no_genitals",
          label: "Genital Exposure",
        },
        butt: { yes: "yes_butt", no: "no_butt", label: "Butt Exposure" },
        sexual_activity: {
          yes: "yes_sexual_activity",
          no: "no_sexual_activity",
          label: "Sexual Activity",
        },
        sexual_intent: {
          yes: "yes_sexual_intent",
          no: "no_sexual_intent",
          label: "Sexual Intent",
        },
        sex_toy: { yes: "yes_sex_toy", no: "no_sex_toy", label: "Sex Toys" },
        cleavage: { yes: "yes_cleavage", no: "no_cleavage", label: "Cleavage" },
        negligee: {
          yes: "yes_negligee",
          no: "no_negligee",
          label: "Revealing Clothing",
        },
        miniskirt: {
          yes: "yes_miniskirt",
          no: "no_miniskirt",
          label: "Miniskirt",
        },
        underwear: {
          yes: "yes_female_underwear",
          no: "no_female_underwear",
          label: "Underwear Visible",
        },
        swimwear: {
          yes: "yes_female_swimwear",
          no: "no_female_swimwear",
          label: "Swimwear",
        },
        shirtless: {
          yes: "yes_male_shirtless",
          no: "no_male_shirtless",
          label: "Shirtless",
        },
      },
    },
    violence: {
      title: "Violence & Weapons",
      pairs: {
        gun: { yes: "yes_gun", no: "no_gun", label: "Gun Presence" },
        gun_in_hand: { yes: "gun_in_hand", no: null, label: "Gun in Hand" },
        knife: { yes: "yes_knife", no: "no_knife", label: "Knife Presence" },
        knife_in_hand: {
          yes: "knife_in_hand",
          no: null,
          label: "Knife in Hand",
        },
        blood: { yes: "yes_blood", no: "no_blood", label: "Blood Content" },
        fight: { yes: "yes_fight", no: "no_fight", label: "Fighting" },
        self_harm: {
          yes: "yes_self_harm",
          no: "no_self_harm",
          label: "Self-harm",
        },
        hanging: {
          yes: "yes_hanging",
          no: "no_hanging_no_noose",
          label: "Hanging Content",
        },
        corpse: { yes: "yes_corpse", no: "no_corpse", label: "Corpse Content" },
      },
    },
    drugs: {
      title: "Drugs & Substances",
      pairs: {
        smoking: { yes: "yes_smoking", no: "no_smoking", label: "Smoking" },
        pills: { yes: "yes_pills", no: "no_pills", label: "Pills" },
        injectables: {
          yes: "yes_injectables",
          no: "no_injectables",
          label: "Injectables",
        },
        marijuana: {
          yes: "yes_marijuana",
          no: "no_marijuana",
          label: "Marijuana",
        },
      },
    },
    hate: {
      title: "Hate & Offensive Content",
      pairs: {
        nazi: { yes: "yes_nazi", no: "no_nazi", label: "Nazi Symbols" },
        kkk: { yes: "yes_kkk", no: "no_kkk", label: "KKK Symbols" },
        terrorist: {
          yes: "yes_terrorist",
          no: "no_terrorist",
          label: "Terrorist Content",
        },
        confederate: {
          yes: "yes_confederate",
          no: "no_confederate",
          label: "Confederate Symbols",
        },
        middle_finger: {
          yes: "yes_middle_finger",
          no: "no_middle_finger",
          label: "Offensive Gestures",
        },
      },
    },
    other: {
      title: "Other Concerns",
      pairs: {
        alcohol: { yes: "yes_alcohol", no: "no_alcohol", label: "Alcohol" },
        gambling: { yes: "yes_gambling", no: "no_gambling", label: "Gambling" },
        animal_abuse: {
          yes: "yes_animal_abuse",
          no: "no_animal_abuse",
          label: "Animal Abuse",
        },
        child_present: {
          yes: "yes_child_present",
          no: "no_child_present",
          label: "Children Present",
        },
        text: { yes: "text", no: "no_text", label: "Text Overlay" },
        overlay_text: {
          yes: "yes_overlay_text",
          no: "no_overlay_text",
          label: "Overlay Text",
        },
      },
    },
  };

  // Create a map of all class values for easy lookup
  const classMap = {};
  classes.forEach((cls) => {
    classMap[cls.class] = cls.value;
  });

  // Process each category and combine yes/no pairs
  const significantThreshold = 0.001; // 0.1%
  const highThreshold = 0.8; // 80%

  Object.keys(contentCategories).forEach((categoryKey) => {
    const category = contentCategories[categoryKey];
    const categoryResults = {
      title: category.title,
      items: [],
      flagged: false,
    };

    Object.keys(category.pairs).forEach((itemKey) => {
      const pair = category.pairs[itemKey];
      const yesValue = classMap[pair.yes] || 0;
      const noValue = classMap[pair.no] || 0;

      // Calculate the confidence for the "yes" case
      const confidence = yesValue;
      const percentage = (confidence * 100).toFixed(2);

      const item = {
        label: pair.label,
        confidence: confidence,
        percentage: percentage,
        severity:
          confidence > highThreshold
            ? "high"
            : confidence > 0.5
            ? "medium"
            : confidence > significantThreshold
            ? "low"
            : "none",
        status: confidence > significantThreshold ? "detected" : "safe",
      };

      categoryResults.items.push(item);

      // Check if this item should flag the content
      if (confidence > significantThreshold) {
        summary.flagged = true;
        summary.safe = false;
        categoryResults.flagged = true;

        const concern = {
          category: category.title,
          type: pair.label,
          confidence: confidence,
          percentage: percentage,
          severity: item.severity,
        };

        summary.concerns.push(concern);
      }
    });

    // Sort items by confidence (highest first)
    categoryResults.items.sort((a, b) => b.confidence - a.confidence);
    summary.categories[categoryKey] = categoryResults;
  });

  // Sort concerns by confidence (highest first)
  summary.concerns.sort((a, b) => b.confidence - a.confidence);

  // Update overall assessment
  if (summary.flagged) {
    const highSeverityCount = summary.concerns.filter(
      (c) => c.severity === "high"
    ).length;
    const mediumSeverityCount = summary.concerns.filter(
      (c) => c.severity === "medium"
    ).length;

    if (highSeverityCount > 0) {
      summary.overallAssessment = `Content flagged with ${highSeverityCount} high-severity concern${
        highSeverityCount > 1 ? "s" : ""
      }`;
    } else if (mediumSeverityCount > 0) {
      summary.overallAssessment = `Content flagged with ${mediumSeverityCount} moderate concern${
        mediumSeverityCount > 1 ? "s" : ""
      }`;
    } else {
      summary.overallAssessment = `Content flagged with ${
        summary.concerns.length
      } minor concern${summary.concerns.length > 1 ? "s" : ""}`;
    }
  } else {
    summary.overallAssessment = "Content appears safe and appropriate";
  }

  return {
    summary,
    detailedResults: summary.categories,
    // Include raw data for debugging if needed
    rawData:
      process.env.NODE_ENV === "development"
        ? {
            totalClasses: classes.length,
            significantFindings: summary.concerns.length,
          }
        : undefined,
  };
};

/**
 * Controller for video moderation using Hive API V3 Visual Moderation
 */
const videoModerationController = {
  /**
   * Analyze a video using Hive API V3 Visual Moderation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  analyzeVideo: async (req, res) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          status: "error",
          message: "No video file uploaded",
        });
      }

      // Check if file is a video
      if (!req.file.mimetype.startsWith("video/")) {
        return res.status(400).json({
          status: "error",
          message: "Uploaded file is not a video",
        });
      }

      console.log("[VIDEO MODERATION] Analyzing video:", req.file.originalname);

      // Get Hive API key from environment
      const HIVE_API_KEY = process.env.HIVE_API_KEY;
      if (!HIVE_API_KEY) {
        return res.status(500).json({
          status: "error",
          message: "Hive API key not configured",
        });
      }

      // Get video URL from Supabase upload
      const videoUrl = req.file.supabaseUrl;

      if (!videoUrl) {
        return res.status(400).json({
          status: "error",
          message:
            "Video URL is required for Hive API processing. Please ensure video was uploaded to Supabase.",
        });
      }

      console.log("[VIDEO MODERATION] Using video URL:", videoUrl);

      // Use Visual Moderation API for both sync and async processing
      return await videoModerationController.analyzeVideoWithVisualModeration(
        req,
        res,
        videoUrl,
        HIVE_API_KEY
      );
    } catch (error) {
      console.error("[VIDEO MODERATION] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Error submitting video analysis job",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * Analyze video using Hive Visual Moderation API
   */
  analyzeVideoWithVisualModeration: async (req, res, videoUrl, apiKey) => {
    try {
      console.log(
        "[VIDEO MODERATION] Using Visual Moderation API for:",
        req.file.originalname
      );

      const response = await axios.post(
        "https://api.thehive.ai/api/v3/hive/visual-moderation",
        {
          input: [
            {
              media_url: videoUrl,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 300000, // 5 minutes timeout
        }
      );
      if (response.data && response.data.output) {
        const output = response.data.output[0]; // Get first output

        // Format the response using our helper function
        const formattedResults = formatHiveResponse(output);

        return res.status(200).json({
          status: "success",
          message: "Video analysis completed",
          data: {
            jobId: response.data.task_id || null,
            videoUrl: videoUrl,
            fileName: req.file.originalname,
            status: "completed",
            flagged: formattedResults.summary.flagged,
            summary: formattedResults.summary,
            detailedResults: formattedResults.detailedResults,
            processingType: "visual-moderation",
            taskId: response.data.task_id,
          },
        });
      } else {
        return res.status(500).json({
          status: "error",
          message: "Invalid response from Hive Visual Moderation API",
          details: response.data,
        });
      }
    } catch (error) {
      console.error("[VIDEO MODERATION] Visual Moderation error:", error);

      // Handle specific Hive API errors
      if (error.response?.status === 403) {
        return res.status(403).json({
          status: "error",
          message:
            "Access denied by Hive API. Please check your API key and video URL accessibility.",
        });
      }

      if (error.response?.status === 400) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid request to Hive API. Please check video format and URL.",
        });
      }

      if (error.response?.status === 404) {
        return res.status(404).json({
          status: "error",
          message:
            "Hive API endpoint not found. Please check API version and endpoint.",
        });
      }

      return res.status(500).json({
        status: "error",
        message: "Error in video analysis",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * Check the status of a video analysis job (if needed for async processing)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  checkJobStatus: async (req, res) => {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({
          status: "error",
          message: "Job ID is required",
        });
      }

      const HIVE_API_KEY = process.env.HIVE_API_KEY;
      if (!HIVE_API_KEY) {
        return res.status(500).json({
          status: "error",
          message: "Hive API key not configured",
        });
      }

      // For Visual Moderation API, most requests are synchronous
      // But we can check if there's a task status endpoint
      const response = await axios.get(
        `https://api.thehive.ai/api/v3/hive/visual-moderation/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${HIVE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data) {
        const result = response.data;

        if (result.status === "completed") {
          const output = result.output[0];

          // Format the response using our helper function
          const formattedResults = formatHiveResponse(output);

          return res.status(200).json({
            status: "success",
            message: "Video analysis completed",
            data: {
              jobId,
              status: "completed",
              flagged: formattedResults.summary.flagged,
              summary: formattedResults.summary,
              detailedResults: formattedResults.detailedResults,
              processingType: "visual-moderation",
            },
          });
        } else if (result.status === "failed") {
          return res.status(500).json({
            status: "error",
            message: "Video analysis failed",
            details: result.error || "Unknown error",
          });
        } else {
          return res.status(200).json({
            status: "success",
            message: "Video analysis in progress",
            data: {
              jobId,
              status: result.status || "processing",
              processingType: "visual-moderation",
            },
          });
        }
      } else {
        return res.status(500).json({
          status: "error",
          message: "Failed to check job status",
          details: response.data,
        });
      }
    } catch (error) {
      console.error("[VIDEO MODERATION] Job status check error:", error);

      if (error.response?.status === 403) {
        return res.status(403).json({
          status: "error",
          message: "Access denied by Hive API. Please check your API key.",
        });
      }

      if (error.response?.status === 404) {
        return res.status(404).json({
          status: "error",
          message: "Job not found. Please check the job ID.",
        });
      }

      return res.status(500).json({
        status: "error",
        message: "Error checking job status",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * Webhook handler for Hive API callbacks (if needed)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  webhookHandler: async (req, res) => {
    try {
      console.log("[VIDEO MODERATION] Webhook received:", req.body);

      // Validate webhook data
      if (!req.body || !req.body.task_id) {
        console.log("[VIDEO MODERATION] Invalid webhook data received");
        return res.status(400).send("Invalid webhook data");
      }

      // Process webhook data
      const taskId = req.body.task_id;
      const output = req.body.output;

      if (output && output[0]) {
        // Format the response using our helper function
        const formattedResults = formatHiveResponse(output[0]);

        // Here you can save results to database, send notifications, etc.
        console.log("Webhook results:", {
          taskId: taskId,
          flagged: formattedResults.summary.flagged,
          concerns: formattedResults.summary.concerns,
        });

        // Save to database or notify admin
        // await saveModerationResults(taskId, output[0], formattedResults.summary);

        // For local testing, you can also log to a file
        if (process.env.NODE_ENV === "development") {
          const fs = require("fs");
          const webhookLog = {
            timestamp: new Date().toISOString(),
            taskId: taskId,
            summary: formattedResults.summary,
            detailedResults: formattedResults.detailedResults,
          };
          fs.appendFileSync(
            "webhook-logs.json",
            JSON.stringify(webhookLog) + "\n"
          );
        }
      }

      res.status(200).send("Received");
    } catch (error) {
      console.error("[VIDEO MODERATION] Webhook error:", error);
      res.status(500).send("Error processing webhook");
    }
  },
};

module.exports = videoModerationController;
